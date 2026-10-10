import { defineManifest } from '@crxjs/vite-plugin';

export const manifest = {
	manifest_version: 3,
	name: 'AudioTube',
	description: 'Listen to YouTube as audio only, with a side panel player.',
	version: '0.0.1',
	minimum_chrome_version: '116',
	permissions: ['storage', 'sidePanel', 'scripting'],
	host_permissions: ['https://www.youtube.com/*'],
	action: { default_title: 'Open AudioTube' },
	side_panel: { default_path: 'src/sidepanel/index.html' },
	background: { service_worker: 'src/background/index.ts', type: 'module' },
	content_scripts: [
		{
			matches: ['https://www.youtube.com/*'],
			js: ['src/content/index.ts'],
			run_at: 'document_idle'
		}
	],
	icons: {
		'16': 'public/icons/icon16.png',
		'48': 'public/icons/icon48.png',
		'128': 'public/icons/icon128.png'
	}
};

export default defineManifest(manifest);
