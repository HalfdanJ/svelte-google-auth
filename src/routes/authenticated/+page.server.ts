import { isSignedIn } from '$lib/googleAuth.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!isSignedIn(locals)) throw error(403, 'Not signed in');
};
