/* eslint-disable no-undef */
import { test as base } from '@playwright/test';

export const test = base.extend({
	app: async ({ page }, use) => {
		// these are assumed to have been put in the global scope by the layout
		use({
			/**
			 * @param {string} url
			 * @param {{ replaceState?: boolean }} opts
			 * @returns {Promise<void>}
			 */
			goto: (url, opts) =>
				page.evaluate(
					(/** @type {{ url: string, opts: { replaceState?: boolean } }} */ { url, opts }) =>
						goto(url, opts),
					{ url, opts }
				),

			/**
			 * @param {string} url
			 * @returns {Promise<void>}
			 */
			invalidate: (url) => page.evaluate((/** @type {string} */ url) => invalidate(url), url),

			/**
			 * @param {(url: URL) => void | boolean | Promise<void | boolean>} fn
			 * @returns {Promise<void>}
			 */
			beforeNavigate: (fn) =>
				page.evaluate((/** @type {(url: URL) => any} */ fn) => beforeNavigate(fn), fn),

			/**
			 * @returns {Promise<void>}
			 */
			afterNavigate: () => page.evaluate(() => afterNavigate(() => undefined)),

			/**
			 * @param {string} url
			 * @returns {Promise<void>}
			 */
			prefetch: (url) => page.evaluate((/** @type {string} */ url) => prefetch(url), url),

			/**
			 * @param {string[]} [urls]
			 * @returns {Promise<void>}
			 */
			prefetchRoutes: (urls) => page.evaluate((urls) => prefetchRoutes(urls), urls)
		});
	},

	clicknav: async ({ page, javaScriptEnabled }, use) => {
		/**
		 * @param {string} selector
		 * @param {{ timeout: number }} options
		 */
		async function clicknav(selector, options) {
			if (javaScriptEnabled) {
				await Promise.all([page.waitForNavigation(options), page.click(selector)]);
			} else {
				await page.click(selector);
			}
		}

		use(clicknav);
	},

	in_view: async ({ page }, use) => {
		/** @param {string} selector */
		async function in_view(selector) {
			const box = await page.locator(selector).boundingBox();
			const view = await page.viewportSize();
			return box && view && box.y < view.height && box.y + box.height > 0;
		}

		use(in_view);
	},

	page: async ({ page, javaScriptEnabled }, use) => {
		if (javaScriptEnabled) {
			page.addInitScript({
				content: `
					addEventListener('sveltekit:start', () => {
						document.body.classList.add('started');
					});
				`
			});
		}

		// automatically wait for kit started event after navigation functions if js is enabled
		const page_navigation_functions = ['goto', 'goBack', 'reload'];
		page_navigation_functions.forEach((fn) => {
			const page_fn = page[fn];
			if (!page_fn) {
				throw new Error(`function does not exist on page: ${fn}`);
			}

			page[fn] = async function (...args) {
				const res = await page_fn.call(page, ...args);
				if (javaScriptEnabled) {
					await page.waitForSelector('body.started', { timeout: 5000 });
				}
				return res;
			};
		});

		await use(page);
	}
});
