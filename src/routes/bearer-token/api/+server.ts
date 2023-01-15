import { getAuthLocals } from '$lib/server.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ locals }) => {
	return json(getAuthLocals(locals).user);
};
