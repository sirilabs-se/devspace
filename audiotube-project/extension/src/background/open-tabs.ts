const YOUTUBE_TABS = 'https://www.youtube.com/*';

/** Adds the content script to YouTube tabs that were open before the extension was installed or updated. */
export async function injectIntoOpenTabs(): Promise<void> {
	const files = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.js ?? []);
	if (!files?.length) return;
	const tabs = await chrome.tabs.query({ url: YOUTUBE_TABS });
	await Promise.allSettled(
		tabs
			.filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
			.map((tab) => chrome.scripting.executeScript({ target: { tabId: tab.id }, files }))
	);
}
