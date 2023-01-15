<script lang="ts">
	import { browser } from '$app/environment';
	import { signOut } from '$lib/client.js';
	import type { PageData } from './$types.js';
	export let data: PageData;

	const apiDataPromise =
		browser &&
		fetch('/bearer-token/api', {
			credentials: 'omit',
			headers: {
				Authorization: `Bearer ${data.auth.access_token}`
			}
		}).then((res) => res.json());
</script>

<h1>Example of requesting authentication using bearer token.</h1>

{#await apiDataPromise}
	Fetching...
{:then apiData}
	<pre>
{JSON.stringify(apiData, null, 2)}
	</pre>
{/await}

<button on:click={() => signOut()}>Sign out</button>
