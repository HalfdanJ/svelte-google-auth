import { get, writable } from 'svelte/store';
import { AUTH_CODE_CALLBACK_URL, AUTH_SIGNOUT_URL } from './constants.js';

/**
 * Prompt user to sign in using google auth
 */
export async function signIn(scopes: string[] = ['openid', 'profile', 'email']) {
	await loadGIS();

	const { invalidate } = await import('$app/navigation').catch((e) => ({
		invalidate: () => undefined
	}));
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
					await invalidate();
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
	const { invalidate } = await import('$app/navigation').catch((e) => ({
		invalidate: () => undefined
	}));

	await fetch(AUTH_SIGNOUT_URL, { method: 'POST' });
	if (window.gapi) gapi.client.setToken({ access_token: '' });

	await invalidate();
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

	const { page } = await import('$app/stores').catch(() => ({ page: undefined }));

	if (!page) return null;
	const access_token = get(page)?.data?.auth?.access_token;
	if (access_token) gapi.client.setToken({ access_token: get(page).data.auth.access_token });
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
	const { page } = await import('$app/stores').catch(() => ({ page: undefined }));
	if (!page) return '';

	const clientId = get(page).data?.auth?.client_id as string;
	if (!clientId) {
		throw new Error(
			'svelte-google-auth could not find required data from page data. \nDid you remember to return `hydrateAuth(locals)` in +layout.server.ts?'
		);
	}
	return clientId;
}
