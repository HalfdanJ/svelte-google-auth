<script lang="ts">
	import { signOut } from '$lib/client.js';
	import type { PageData } from './$types.js';
	export let data: PageData;
</script>

<h1>Example of page that requires authentication.</h1>

<p>You can view this page right now because you are authenticate as {data.auth.user?.name}.</p>

<button on:click={() => signOut()}>Sign out</button>
