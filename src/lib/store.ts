import { page } from '$app/stores';
import { derived } from 'svelte/store';
import type { AuthClientData } from './server.js';

export const user = derived(page, ($page) => ($page?.data?.auth as AuthClientData)?.user);
