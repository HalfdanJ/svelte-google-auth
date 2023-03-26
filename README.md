# svelte-google-auth

[![NPM version](https://img.shields.io/npm/v/svelte-google-auth.svg?style=flat)](https://www.npmjs.com/package/svelte-google-auth)
[![stability-beta](https://img.shields.io/badge/stability-beta-33bbff.svg)](https://github.com/mkenney/software-guides/blob/master/STABILITY-BADGES.md#beta)

This library provides an easy-to-use solution for Google authentication in sveltekit, facilitating interaction with Google Identity Services and cookie storage for authenticated users in subsequent visits. It also allows authorized Google API calls from client and server sides. 

## How it works

The library follows the offical guide for [oauth2 code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model#redirect-mode).

1. User authenticates with the site in a popup
2. Popup responds with a code that gets send to the backend
3. Backend converts the code to tokens (both access token and refresh token)
4. Tokens get signed into a jwt httpOnly cookie, making every subsequent call to the backend authenticated
5. Library returns the authenticated user back to the client using [page data](https://kit.svelte.dev/docs/load)




## Getting started

### Install

```
npm i svelte-google-auth
```

### Credentials

Create an [OAuth2 Client Credentials](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) in Google Cloud. Store the JSON file in your project but avoid committing it to Git. The following Authorized redirect URIs and Authorized JavaScript origins must be added:
- Authorized JavaScript origins: `http://localhost:5173`
- Authorized redirect URIs: `http://localhost:5173/_auth/callback`


### Hooks

In `src/hooks.server.(js|ts)`, initialize the authentication hook.

```ts
import { SvelteGoogleAuthHook } from 'svelte-google-auth/server';
import type { Handle } from '@sveltejs/kit';

// Import client credentials from json file
import client_secret from '../client_secret.json';

const auth = new SvelteGoogleAuthHook(client_secret.web);

export const handle: Handle = async ({ event, resolve }) => {
	return await auth.handleAuth({ event, resolve });
};
```

### +layout.server

In the `src/routes/+layout.server.(js|ts)` file, create the following `load` function:

```ts
import { hydrateAuth } from 'svelte-google-auth/server';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = ({ locals }) => {
	// By calling hydateAuth, certain variables from locals are parsed to the client
	// allowing the client to access the user information and the client_id for login
	return { ...hydrateAuth(locals) };
};
```

To force a user to sign in, you can redirect them to the login page as shown in the following updated `load` function:

```ts
import { hydrateAuth } from 'svelte-google-auth/server';
import type { LayoutServerLoad } from './$types.js';

const SCOPES = ['openid', 'profile', 'email'];

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!isSignedIn(locals)) {
		throw redirect(302, generateAuthUrl(locals, url, SCOPES, url.pathname));
	}
	// By calling hydateAuth, certain variables from locals are parsed to the client
	// allowing the client to access the user information and the client_id for login
	return { ...hydrateAuth(locals) };
};
```

### Page

You can now use the library on any page/layout like this

```html
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { signIn, signOut, initialize } from 'svelte-google-auth/client';
	import type { PageData } from './$types.js';

	export let data: PageData;
	initialize(data, invalidateAll);
</script>

{data.auth.user?.name}
<button on:click={() => signIn()}>Sign In</button>
<button on:click={() => signOut()}>Sign Out</button>
```

## Example

Check out the [example](/src/routes) to see how the api can be used. Run `npm run dev` to run it locally.

