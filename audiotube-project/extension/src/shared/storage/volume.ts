export const VOLUME_KEY = 'volume';

/** The volume the extension remembers, and whether it is muted (`PLY-061` to `PLY-063`). */
export interface Volume {
	/** 0 to 100, as YouTube's own control counts it. */
	level: number;
	muted: boolean;
}

export function isVolumeLevel(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

/** A stored value that is missing or not valid reads as not known yet. */
export function parseVolume(raw: unknown): Volume | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const v = raw as Record<string, unknown>;
	if (!isVolumeLevel(v.level)) return null;
	return { level: v.level, muted: v.muted === true };
}

export async function readVolume(): Promise<Volume | null> {
	const items = await chrome.storage.local.get(VOLUME_KEY);
	return parseVolume(items[VOLUME_KEY]);
}

export function watchVolume(listener: (volume: Volume | null) => void): () => void {
	let latest = 0;
	const onChanged = (changes: Record<string, unknown>, area: string) => {
		if (area !== 'local' || !(VOLUME_KEY in changes)) return;
		const ticket = ++latest;
		readVolume().then(
			(volume) => {
				if (ticket === latest) listener(volume);
			},
			() => {}
		);
	};
	chrome.storage.onChanged.addListener(onChanged);
	return () => chrome.storage.onChanged.removeListener(onChanged);
}
