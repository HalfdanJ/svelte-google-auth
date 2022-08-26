import { SvelteGoogleAuthHook } from '$lib/googleAuth.js';
import type { Handle } from '@sveltejs/kit';
import client_secret from '../client_secret.json';

const auth = new SvelteGoogleAuthHook(client_secret.web);

export const handle: Handle = async ({ event, resolve }) => {
	return await auth.handleAuth({ event, resolve });
};
