import { error, type Handle } from '@sveltejs/kit';
import cookie from 'cookie';
import { createDecoder, createSigner, createVerifier, SignerSync } from 'fast-jwt';
import type { Credentials, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

import { AUTH_CODE_CALLBACK_URL, AUTH_SIGNOUT_URL } from './constants.js';

export type DecodedIdToken = {
	iss: string;
	azp: string;
	aud: string;
	sub: string;
	hd: string;
	email: string;
	email_verified: string;
	at_hash: string;
	name: string;
	picture: string;
	given_name: string;
	family_name: string;
	locale: string;
	iat: string;
	exp: string;
};

export interface AuthLocals {
	access_token?: string;
	user?: DecodedIdToken;
	token?: Credentials;
	client_id: string;
	client: OAuth2Client;
}

export interface AuthClientData {
	user: DecodedIdToken | undefined;
	client_id: string;
	access_token?: string;
}

export function getAuthLocals(locals: App.Locals) {
	return locals as AuthLocals;
}

/**
 * Hydrates the client with data from auth
 *
 * @param locals the apps locals
 * @returns data served to the client
 */
export function hydrateAuth(locals: App.Locals) {
	const authLocals = getAuthLocals(locals);
	const auth: AuthClientData = {
		user: authLocals.user,
		client_id: authLocals.client_id,
		access_token: authLocals.token?.access_token ?? undefined
	};

	return { auth };
}

export function getOAuth2Client(locals: App.Locals) {
	const authLocals = getAuthLocals(locals);
	return authLocals.client;
}
export function isSignedIn(locals: App.Locals) {
	return !!getAuthLocals(locals).user;
}

export class SvelteGoogleAuthHook {
	private jwtVerifier: ReturnType<typeof createVerifier>;
	private jwtDecoder: ReturnType<typeof createDecoder>;
	private jwtSigner: typeof SignerSync;

	constructor(
		private client: {
			client_id: string;
			client_secret: string;
			jwt_secret?: string;
			[key: string]: unknown;
		},
		private cookie_name = 'svgoogleauth'
	) {
		const key = this.client.jwt_secret ?? this.client.client_secret;
		this.jwtVerifier = createVerifier({ key });
		this.jwtDecoder = createDecoder();
		this.jwtSigner = createSigner({ key });
	}

	public handleAuth: Handle = async ({ event, resolve }) => {
		// Read stored data from signed auth cookie
		const storedTokens = this.parseSignedCookie(event.request);

		// Create a oauth2 client
		const oauth2Client = new google.auth.OAuth2(this.client.client_id, this.client.client_secret);

		(event.locals as AuthLocals) = {
			...event.locals,
			client_id: this.client.client_id,
			client: oauth2Client
		};

		if (storedTokens?.refresh_token) {
			// Obtain a valid access token
			const accessToken = await this.getAccessToken(storedTokens);
			// Decode user information from id token
			const user = this.decodeIdToken(storedTokens);

			// Set credentials on oauth2 client
			oauth2Client.setCredentials(storedTokens);

			// Store tokens and user in locals
			(event.locals as AuthLocals) = {
				...event.locals,
				access_token: accessToken ?? undefined,
				user,
				token: storedTokens,
				client_id: this.client.client_id,
				client: oauth2Client
			};
		}

		// Inject url's for handling sign in and out
		if (event.url.pathname === AUTH_CODE_CALLBACK_URL) {
			return this.handlePostCode({ event, resolve });
		} else if (event.url.pathname === AUTH_SIGNOUT_URL) {
			return this.handleSignOut({ event, resolve });
		}

		return await resolve(event);
	};

	private handleSignOut: Handle = async () => {
		// Overwrite the stored cookie with an empty jwt token
		const signed = this.signJwtTokens({});

		return new Response('signed out', {
			headers: {
				'set-cookie': `${this.cookie_name}=${signed}; Path=/; HttpOnly`
			}
		});
	};

	private handlePostCode: Handle = async ({ event }) => {
		// https://developers.google.com/identity/oauth2/web/guides/use-code-model#validate_the_request
		if (event.request.headers.get('X-Requested-With') !== 'XmlHttpRequest') {
			throw error(403, 'Request is not valid. Does not contain correct X-Requested-With header');
		}

		const formData = await event.request.formData();
		const code = formData.get('code');

		if (!code) {
			throw error(500, 'No code to get token for');
		}
		const tokens = await this.getTokenFromCode(code.toString(), 'postmessage');
		const signedTokens = this.signJwtTokens(tokens);

		return new Response('ok', {
			headers: {
				'set-cookie': `${this.cookie_name}=${signedTokens}; Path=/; HttpOnly`
			}
		});
	};

	async getTokenFromCode(code: string, redirect_uri: string) {
		const oauth2Client = new google.auth.OAuth2(
			this.client.client_id,
			this.client.client_secret,
			redirect_uri
		);

		const { tokens } = await oauth2Client.getToken(code.toString()).catch((e) => {
			if (e.message === 'redirect_uri_mismatch') {
				console.error(`Redirect uri mismatch. Client configured with uri '${redirect_uri}'`);
				throw error(500, 'Oauth redirect uri mismatch');
			}
			throw error(
				403,
				e.response?.data?.error_description ?? 'Could not obtain tokens from oauth2 code'
			);
		});
		return tokens;
	}

	private async getAccessToken(tokens: Credentials) {
		const client = new google.auth.OAuth2(this.client.client_id, this.client.client_secret);
		client.setCredentials(tokens);

		const newAccessTokens = await client.getAccessToken();
		return newAccessTokens.token;
	}

	private signJwtTokens(tokens: Credentials) {
		return this.jwtSigner(tokens);
	}

	private parseSignedCookie(request: Request): null | Credentials {
		const cookies = request.headers.get('cookie');
		if (!cookies) return null;

		const parsedCookies = cookie.parse(cookies);
		const authCookie = parsedCookies[this.cookie_name] ?? null;
		if (!authCookie) return null;

		return this.jwtVerifier(authCookie) as Credentials;
	}

	private decodeIdToken(tokens: Credentials) {
		if (!tokens.id_token) return undefined;
		const decoded = this.jwtDecoder(tokens.id_token) as DecodedIdToken;
		if (decoded.iss !== 'https://accounts.google.com')
			throw error(403, 'Invalid id_token issuer ' + decoded.iss);
		return decoded;
	}
}
