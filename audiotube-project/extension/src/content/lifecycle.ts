/** False once the extension has been updated, reloaded or removed and this copy of the script is cut off from it. */
export function isExtensionAlive(): boolean {
	try {
		return !!chrome.runtime?.id;
	} catch {
		return false;
	}
}

/** Takes away what an older, cut-off copy of the script left on the page. */
export function removeLeftovers(doc: Document): void {
	for (const element of doc.querySelectorAll('audiotube-overlay, audiotube-control')) {
		element.remove();
	}
}
