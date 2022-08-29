# svelte-google-auth

> :warning: **Work in progress**: Use at your own risk

This library makes it easy to use Google authentication in sveltekit. The library handles the interaction with [Google Identity Services](https://developers.google.com/identity), and stores the authenticated user in a cookie for subsequent visits.

The library makes it possible to run authorized google api calls from both client side and server side.

## How does it work

The library follows in broad strokes the offical guide for [oauth2 code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model#redirect-mode).

1. The user authenticates with the site in a popup
2. The popup responds with a code that gets send to the backend
3. Backend converts the code to tokens (both access token and refresh token)
4. The tokens get signed into a jwt httpOnly cookie, making every subsequent call to the backend authenticated
5. The library returns the authenticated user back to the client using [page data](https://kit.svelte.dev/docs/load)

## Example

[/src/routes](/src/routes) Shows how the api can be used. Run `npm run dev` to run it locally.

## Getting started

### Install

Run

```
npm i svelte-google-auth
```

### Credentials

To use the library, first create a [OAuth2 Client Credentials](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) in Google Cloud. Store the json file in your project, but make sure to not commiting the file to git.

Add `http://localhost:5173` as Authorized JavaScript origins, and
`http://localhost:5173/_auth/callback` as Authorized redirect URIs

### hooks

In `src/hooks.(js|ts)`, initialize the authentication hook.

```ts
import { SvelteGoogleAuthHook } from 'svelte-google-auth';
import type { Handle } from '@sveltejs/kit';

// Import client credentials from json file
import client_secret from '../client_secret.json';

const auth = new SvelteGoogleAuthHook(client_secret.web);

export const handle: Handle = async ({ event, resolve }) => {
	return await auth.handleAuth({ event, resolve });
};
```

This hook creates url routes needed for authentication callbacks, and parses authentication cookies on each request.

### +layout.server

In `src/routes/+layout.server.(js|ts)`, create the following load function:

```ts
import { hydrateAuth } from 'svelte-google-auth';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = ({ locals }) => {
	// By calling hydateAuth, certain variables from locals are parsed to the client
	// allowing the client to access the user information and the client_id for login
	return { ...hydrateAuth(locals) };
};
```

### Page

You can now use the library on any page/layout like this

```html
<script lang="ts">
	import { signIn, signOut, user } from 'svelte-google-auth/client';
</script>

{$user?.name}
<button on:click={() => signIn()}>Sign In</button>
<button on:click={() => signOut()}>Sign Out</button>
```
