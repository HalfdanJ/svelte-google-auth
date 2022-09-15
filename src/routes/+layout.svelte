<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { signIn, signOut, initialize } from '$lib/client.js';
	import type { PageData } from './$types.js';

	export let data: PageData;
	initialize(data, invalidateAll);

	console.log('data', data);
</script>

<header>
	{#if data.auth.user}
		<p>
			Signed in as {data.auth.user.name} ({data.auth.user.email})
			<img src={data.auth.user.picture} width={36} referrerpolicy="no-referrer" alt="profile" />
		</p>
		<p>
			<button on:click={() => signOut()}>Sign out</button>
		</p>
	{:else}
		<p>
			<button
				on:click={() =>
					signIn([
						'openid',
						'profile',
						'email',
						'https://www.googleapis.com/auth/calendar.readonly'
					])}>Sign in</button
			>
		</p>
	{/if}
</header>

<slot />

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet" />
</svelte:head>

<style>
	:global(body) {
		font-family: 'Roboto', sans-serif;
		max-width: 800px;
		margin: auto;
	}

	header {
		border-bottom: 1px solid #ccc;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	header p {
		display: flex;
		align-items: center;
	}
</style>
