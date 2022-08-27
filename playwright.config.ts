import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run dev -- --port 5174',
		port: 5174
	}
};

export default config;
