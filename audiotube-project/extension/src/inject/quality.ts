export interface PlayerApi {
	getAvailableQualityLevels?: () => unknown;
	setPlaybackQualityRange?: (min: string, max?: string) => void;
}

export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export type Outcome = 'done' | 'unavailable';

/** YouTube keeps the user's own quality choice here: the height in pixels, or 0 for Auto. */
export const PREFERENCE_KEY = 'yt-player-quality';
/** Where this extension keeps the choice it replaced, so it can be put back after a reload. */
export const PREVIOUS_KEY = 'audiotube.previousQuality';

const LEVEL_BY_HEIGHT: Record<number, string> = {
	144: 'tiny',
	240: 'small',
	360: 'medium',
	480: 'large',
	720: 'hd720',
	1080: 'hd1080',
	1440: 'hd1440',
	2160: 'hd2160'
};

/** The level name for YouTube's stored preference. Anything missing, Auto or unreadable is `auto`. */
export function levelFromPreference(raw: string | null): string {
	try {
		const outer = JSON.parse(raw ?? 'null') as { data?: unknown } | null;
		const inner = JSON.parse(typeof outer?.data === 'string' ? outer.data : 'null') as {
			quality?: unknown;
		} | null;
		const height = inner?.quality;
		return typeof height === 'number' ? (LEVEL_BY_HEIGHT[height] ?? 'auto') : 'auto';
	} catch {
		return 'auto';
	}
}

/** The player lists levels best first with `auto` last, so the lowest is the last one that is not `auto`. */
export function lowestLevel(levels: unknown): string | null {
	if (!Array.isArray(levels)) return null;
	const named = levels.filter(
		(level): level is string => typeof level === 'string' && level !== 'auto'
	);
	return named.at(-1) ?? null;
}

function readLowest(player: PlayerApi): string | null {
	try {
		return lowestLevel(player.getAvailableQualityLevels?.());
	} catch {
		return null;
	}
}

export function createQualityManager(deps: {
	player: () => PlayerApi | null;
	store: KeyValueStore;
}) {
	let applied = false;

	function request(player: PlayerApi, level: string): boolean {
		try {
			if (level === 'auto') player.setPlaybackQualityRange!('auto');
			else player.setPlaybackQualityRange!(level, level);
			return true;
		} catch {
			return false;
		}
	}

	return {
		/** Asks for the lowest quality, first remembering what the user had chosen. */
		applyLowest(): Outcome {
			const player = deps.player();
			if (!player?.setPlaybackQualityRange) return 'unavailable';
			const lowest = readLowest(player);
			if (!lowest) return 'unavailable';

			if (deps.store.getItem(PREVIOUS_KEY) === null) {
				deps.store.setItem(PREVIOUS_KEY, levelFromPreference(deps.store.getItem(PREFERENCE_KEY)));
			}
			if (!request(player, lowest)) return 'unavailable';
			applied = true;
			return 'done';
		},

		/** Puts back what the user had, if this extension changed it. Does nothing otherwise. */
		restore(): Outcome {
			const previous = deps.store.getItem(PREVIOUS_KEY);
			if (previous === null && !applied) return 'done';
			const player = deps.player();
			if (!player?.setPlaybackQualityRange) return 'unavailable';
			const target = previous ?? levelFromPreference(deps.store.getItem(PREFERENCE_KEY));
			if (!request(player, target)) return 'unavailable';
			deps.store.removeItem(PREVIOUS_KEY);
			applied = false;
			return 'done';
		}
	};
}
