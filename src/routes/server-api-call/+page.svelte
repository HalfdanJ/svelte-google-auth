<script lang="ts">
	import type { PageData } from './$types.js';
	export let data: PageData;
</script>

<h1>Example of api call from the server</h1>
<p>When loaded, the server fetches data from the api, and injects it into the page data.</p>

{#if data.auth.user}
	Next event: {data.calendarEvent?.summary}
{:else}
	Not signed in
{/if}
