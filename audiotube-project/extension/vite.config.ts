import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import manifest from './manifest.config.ts';

export default defineConfig({
	plugins: [tailwindcss(), svelte(), crx({ manifest })],
	server: { cors: { origin: [/chrome-extension:\/\//] } },
	build: { outDir: 'dist', emptyOutDir: true }
});
