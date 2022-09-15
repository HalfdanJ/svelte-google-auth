import type { invalidateAll } from '$app/navigation';
import { AUTH_CODE_CALLBACK_URL, AUTH_SIGNOUT_URL } from './constants.js';
import type { AuthClientData } from './server.js';

interface AuthContext {
	getData: () => AuthClientData;
	invalidateAll: typeof invalidate;
}

let context: AuthContext | undefined = undefined;

function getAuthContext(): AuthContext {
	if (!context)
		throw new Error(
			'svelte-google-auth context not defined. Did you forget to call `initialize(data)` +layout.svelte?'
		);
	return context;
}

export async function initialize(
	data: { auth: AuthClientData },
	_invalidateAll: typeof invalidateAll
) {
	context = {
		getData: () => data.auth,
		invalidateAll: () => _invalidateAll()
	};
}

/**
 * Prompt user to sign in using google auth
 */
export async function signIn(scopes: string[] = ['openid', 'profile', 'email']) {
	await loadGIS();

	const client_id = await getClientId();

	return new Promise<void>((resolve, reject) => {
		const client = google.accounts.oauth2.initCodeClient({
			client_id,
			scope: scopes.join(' '),
			ux_mode: 'popup',

			callback: (response: any) => {
				const { code, scope } = response;
				const xhr = new XMLHttpRequest();
				xhr.open('POST', AUTH_CODE_CALLBACK_URL, true);
				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				// Set custom header for CRSF
				xhr.setRequestHeader('X-Requested-With', 'XmlHttpRequest');
				xhr.onload = async function () {
					console.log('Auth code response: ' + xhr.responseText);
					await getAuthContext().invalidateAll();
					resolve();
				};
				xhr.onerror = reject;
				xhr.onabort = reject;
				xhr.send('code=' + code);
			}
		});
		client.requestCode();
	});
}

/** Sign user out */
export async function signOut() {
	await fetch(AUTH_SIGNOUT_URL, { method: 'POST' });
	if (window.gapi) gapi.client.setToken({ access_token: '' });

	await getAuthContext().invalidateAll();
}

let _gapiClientInitialized = false;
/** Returns initialized gapi client */
export async function getGapiClient(
	args: {
		apiKey?: string | undefined;
		discoveryDocs?: string[] | undefined;
	} = {}
) {
	if (!_gapiClientInitialized) {
		await loadGAPI();
		await new Promise((resolve, reject) => {
			gapi.load('client', { callback: resolve, onerror: reject });
		});
		await gapi.client.init({ ...args });
		_gapiClientInitialized = true;
	}

	const access_token = getAuthContext().getData().access_token;
	if (access_token) gapi.client.setToken({ access_token });
	return gapi.client;
}

async function injectScript(src: string) {
	return new Promise((resolve, reject) => {
		// GIS Library, loads itself onto the window as 'google'
		const googscr = document.createElement('script');
		googscr.type = 'text/javascript';
		googscr.src = src;
		googscr.defer = true;
		googscr.onload = resolve;
		googscr.onerror = reject;
		document.head.appendChild(googscr);
	});
}

export async function loadGIS() {
	if (window.google?.accounts?.oauth2) return;
	return injectScript('https://accounts.google.com/gsi/client');
}
export async function loadGAPI() {
	if (window.gapi) return;
	return injectScript('https://apis.google.com/js/api.js');
}

export async function getClientId() {
	const data = getAuthContext().getData();

	const clientId = data.client_id as string;
	if (!clientId) {
		throw new Error(
			'svelte-google-auth could not find required data from page data. \nDid you remember to return `hydrateAuth(locals)` in +layout.server.ts?'
		);
	}
	return clientId;
}
