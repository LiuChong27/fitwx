import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.js'],
		setupFiles: ['tests/setup.js'],
		coverage: {
			provider: 'v8',
			include: ['common/**', 'store/**', 'services/**'],
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname),
		},
	},
});
