// @ts-check
import { expect } from '@playwright/test';
import { test } from './utils.js';

test.describe('auth', () => {
	test('page signed out by default', async ({ page }) => {
		await page.goto('/');
		const signInButton = page.locator('text=Sign in');
		await expect(signInButton).toHaveCount(1);
	});

	test('authenticated route throws 403', async ({ page }) => {
		await page.goto('/authenticated');
		expect(await page.textContent('h1')).toBe('403');
	});
});
