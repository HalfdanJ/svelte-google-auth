import { getOAuth2Client, isSignedIn } from '$lib/googleAuth.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { PageServerLoad } from './$types.js';

async function fetchCalendar(auth: OAuth2Client) {
	const calendar = google.calendar({ version: 'v3', auth });
	const res = await calendar.events.list({
		calendarId: 'primary',
		timeMin: new Date().toISOString(),
		maxResults: 1,
		singleEvents: true,
		orderBy: 'startTime'
	});
	return res.data.items?.[0];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (isSignedIn(locals)) {
		// Get an authenticated oauth2 client
		const client = getOAuth2Client(locals);
		// Fetch calendar events using the client
		const calendarEvent = await fetchCalendar(client);

		return {
			calendarEvent
		};
	}
};
