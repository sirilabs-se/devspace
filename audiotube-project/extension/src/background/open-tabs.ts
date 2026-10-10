const YOUTUBE_TABS = 'https://www.youtube.com/*';

// The manifest type does not list `world`, which Chrome supports on content scripts.
type ManifestContentScript = { js?: string[]; world?: 'ISOLATED' | 'MAIN' };

/** Adds the content scripts to YouTube tabs that were open before the extension was installed or updated. */
export async function injectIntoOpenTabs(): Promise<void> {
	const scripts = (chrome.runtime.getManifest().content_scripts ?? []) as ManifestContentScript[];
	if (!scripts.some((script) => script.js?.length)) return;
	const tabs = await chrome.tabs.query({ url: YOUTUBE_TABS });
	const jobs = tabs
		.filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
		.flatMap((tab) =>
			scripts
				.filter((script) => script.js?.length)
				.map((script) =>
					chrome.scripting.executeScript({
						target: { tabId: tab.id },
						files: script.js!,
						...(script.world ? { world: script.world } : {})
					})
				)
		);
	await Promise.allSettled(jobs);
}
