<script lang="ts">
	import { signOut, user } from '$lib/client.js';
	import type { PageData } from './$types.js';
</script>

<h1>Example of page that requires authentication.</h1>

<p>You can view this page right now because you are authenticate as {$user?.name}.</p>

<button on:click={() => signOut()}>Sign out</button>
