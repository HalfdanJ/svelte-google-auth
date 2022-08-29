import { generateAuthUrl } from '$lib/server.js';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = ({ url, locals }) => {
	throw redirect(
		302,
		generateAuthUrl(
			locals,
			url,
			['openid', 'profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
			'/'
		)
	);
};
