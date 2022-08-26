import { hydrateAuth } from '$lib/googleAuth.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = ({ locals }) => {
	// By calling hydateAuth, certain variables from locals are parsed to the client
	// allowing the client to access the user information and the client_id for login
	return { ...hydrateAuth(locals) };
};
