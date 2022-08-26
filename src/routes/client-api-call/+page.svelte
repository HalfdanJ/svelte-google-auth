<script lang="ts">
	import { getGapiClient, user } from '$lib/client.js';

	$: nextEvent =
		// Don't fetch if user is not authenticated
		$user &&
		// Get gapi client, already initialzed with users access token.
		getGapiClient({
			discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
		})
			// Use the authenticated gapi client to call calendar
			.then((client) =>
				client.calendar.events.list({
					calendarId: 'primary',
					timeMin: new Date().toISOString(),
					showDeleted: false,
					singleEvents: true,
					maxResults: 1,
					orderBy: 'startTime'
				})
			)
			.then((res) => res.result.items[0]);
</script>

<h1>Example of api call from the browser</h1>
<p>
	When loaded, a gapi client is created, injected with the access token generated on the server.
	This gapi client is then used to fetch from calendar api.
</p>

{#if $user}
	{#await nextEvent}
		Fetching...
	{:then _nextEvent}
		Next event: {_nextEvent?.summary}
	{/await}
{:else}
	Not signed in
{/if}
