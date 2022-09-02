import { error, type Handle, type ResolveOptions } from '@sveltejs/kit';
import cookie from 'cookie';
import type { Credentials, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
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

export interface AuthLocals extends App.Locals {
	user?: DecodedIdToken;
	token?: Credentials;
	client_id: string;
	client_secret: string;
	client: OAuth2Client;
}

export interface AuthLocalsSignedIn extends AuthLocals {
	user: DecodedIdToken;
	token: Credentials;
	client_id: string;
	client_secret: string;
	client: OAuth2Client;
}

export interface AuthClientData {
	client_id: string;
	user?: DecodedIdToken;
	access_token?: string;
}

/** Client data when user is signed in */
export interface AuthClientDataSignedIn {
	client_id: string;
	user: DecodedIdToken;
	access_token: string;
}

export function getAuthLocals(locals: App.Locals) {
	return locals as AuthLocals & App.Locals;
}

/**
 * Hydrates the client with data from auth
 *
 * @param locals the apps locals
 * @returns data served to the client
 */
export function hydrateAuth(locals: AuthLocalsSignedIn): { auth: AuthClientDataSignedIn };
export function hydrateAuth(locals: App.Locals): { auth: AuthClientData };
export function hydrateAuth(locals: App.Locals | AuthLocalsSignedIn): {
	auth: AuthClientData | AuthClientDataSignedIn;
} {
	const authLocals = getAuthLocals(locals);
	return {
		auth: {
			user: authLocals.user,
			client_id: authLocals.client_id,
			access_token: authLocals?.token?.access_token ?? undefined
		}
	};
}

export function getOAuth2Client(locals: App.Locals) {
	const authLocals = getAuthLocals(locals);
	return authLocals.client;
}
export function isSignedIn(locals: App.Locals): locals is AuthLocalsSignedIn {
	return !!getAuthLocals(locals).user;
}

export function generateAuthUrl(
	locals: App.Locals,
	url: URL,
	scopes: string[],
	redirectUrl?: string,
	prompt = 'consent'
) {
	const authLocals = getAuthLocals(locals);

	const redirect_uri = `${url.origin}${AUTH_CODE_CALLBACK_URL}`;
	const client = new google.auth.OAuth2(
		authLocals.client_id,
		authLocals.client_secret,
		redirect_uri
	);

	return client.generateAuthUrl({
		access_type: 'offline',
		response_type: 'code',
		prompt,
		scope: scopes,
		redirect_uri,
		state: redirectUrl
	});
}

export class SvelteGoogleAuthHook {
	constructor(
		private client: {
			client_id: string;
			client_secret: string;
			jwt_secret?: string;
			[key: string]: unknown;
			resolveOptions?: ResolveOptions;
		},
		private cookie_name = 'svgoogleauth'
	) {}

	public handleAuth: Handle = async ({ event, resolve }) => {
		// Read stored data from signed auth cookie
		const storedTokens = this.parseSignedCookie(event.request);
		// Create a oauth2 client
		const oauth2Client = new google.auth.OAuth2(this.client.client_id, this.client.client_secret);

		(event.locals as AuthLocals) = {
			...event.locals,
			client_id: this.client.client_id,
			client_secret: this.client.client_secret,
			client: oauth2Client
		};

		if (storedTokens?.refresh_token) {
			// Obtain a valid access token
			const accessToken = await this.getAccessToken(storedTokens);
			// Decode user information from id token
			const user = this.decodeIdToken(storedTokens);

			// Set credentials on oauth2 client
			oauth2Client.setCredentials(storedTokens);

			storedTokens.access_token = accessToken;

			// Store tokens and user in locals
			(event.locals as AuthLocals) = {
				...event.locals,
				user,
				token: storedTokens,
				client_id: this.client.client_id,
				client_secret: this.client.client_secret,
				client: oauth2Client
			};
		}

		// Inject url's for handling sign in and out
		if (event.url.pathname === AUTH_CODE_CALLBACK_URL) {
			if (event.request.method === 'POST') {
				return this.handlePostCode({ event, resolve });
			} else if (event.request.method === 'GET') {
				return this.handleGetCode({ event, resolve });
			}
		} else if (event.url.pathname === AUTH_SIGNOUT_URL) {
			return this.handleSignOut({ event, resolve });
		}

		return await resolve(event, this.client.resolveOptions);
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

	private handleGetCode: Handle = async ({ event }) => {
		const code = event.url.searchParams.get('code');
		const state = event.url.searchParams.get('state') || '/';
		if (!code) {
			throw error(500, 'No code to get token for');
		}
		const redirect_uri = `${event.url.origin}${event.url.pathname}`;
		const tokens = await this.getTokenFromCode(code.toString(), redirect_uri);
		const signedTokens = this.signJwtTokens(tokens);

		return new Response(`Ok`, {
			status: 302,
			headers: {
				'set-cookie': `${this.cookie_name}=${signedTokens}; Path=/; HttpOnly`,
				Location: `${event.url.origin}${state}`
			}
		});
	};

	private async getTokenFromCode(code: string, redirect_uri: string) {
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
		const key = this.client.jwt_secret ?? this.client.client_secret;
		return jwt.sign(tokens, key);
	}

	private parseSignedCookie(request: Request): null | Credentials {
		const cookies = request.headers.get('cookie');
		if (!cookies) return null;

		const parsedCookies = cookie.parse(cookies);
		const authCookie = parsedCookies[this.cookie_name] ?? null;
		if (!authCookie) return null;

		const key = this.client.jwt_secret ?? this.client.client_secret;
		try {
			return jwt.verify(authCookie, key) as Credentials;
		} catch (e) {
			console.warn(e);
			return null;
		}
	}

	private decodeIdToken(tokens: Credentials) {
		if (!tokens.id_token) return undefined;
		const decoded = jwt.decode(tokens.id_token) as unknown as DecodedIdToken;
		if (decoded.iss !== 'https://accounts.google.com')
			throw error(403, 'Invalid id_token issuer ' + decoded.iss);
		return decoded;
	}
}
