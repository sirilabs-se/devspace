/** Calls `callback` (at most once per frame) when YouTube's page may have changed under us. Returns a stop function. */
export function onPageChange(callback: () => void): () => void {
	let scheduled = false;
	const schedule = () => {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			callback();
		});
	};

	const observer = new MutationObserver(schedule);
	observer.observe(document.documentElement, { childList: true, subtree: true });
	document.addEventListener('yt-navigate-finish', schedule);
	addEventListener('popstate', schedule);

	return () => {
		observer.disconnect();
		document.removeEventListener('yt-navigate-finish', schedule);
		removeEventListener('popstate', schedule);
	};
}
