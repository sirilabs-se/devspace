import { readVolume, requestSetVolume, watchVolume, type Volume } from '../../shared';
import type { PlayerCommandResponse } from '../../shared';

export interface VolumeView {
	/** False until a volume is stored; the controls still work and the first change stores one. */
	known: boolean;
	level: number;
	muted: boolean;
}

export interface VolumeController {
	get(): VolumeView;
	subscribe(listener: (view: VolumeView) => void): () => void;
	/** Sets the volume (0 to 100). Moving it above 0 unmutes, as YouTube's own control does. */
	setLevel(level: number): void;
	toggleMute(): void;
	dispose(): void;
}

export interface VolumeDeps {
	read: () => Promise<Volume | null>;
	watch: (listener: (volume: Volume | null) => void) => () => void;
	set: (level: number, muted: boolean) => Promise<PlayerCommandResponse>;
}

const defaultDeps: VolumeDeps = { read: readVolume, watch: watchVolume, set: requestSetVolume };

/** What was just asked for is shown at once, and held for this long while the stored value is on its way. */
export const VOLUME_HOLD_MS = 1500;
/** A slider drag is sent at most this often, and always ends with its last value. */
export const VOLUME_SEND_EVERY_MS = 80;
/** The level a muted volume of 0 comes back to when unmuted. */
export const UNMUTE_FROM_ZERO = 50;

export function createVolumeController(deps: VolumeDeps = defaultDeps): VolumeController {
	let stored: Volume | null = null;
	let asked: Volume | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let sendTimer: ReturnType<typeof setTimeout> | undefined;
	let lastSentAt = 0;
	let pending: Volume | null = null;
	let view: VolumeView = { known: false, level: 100, muted: false };
	const listeners = new Set<(view: VolumeView) => void>();

	function publish() {
		const shown = asked ?? stored;
		const next: VolumeView = {
			known: stored !== null || asked !== null,
			level: shown?.level ?? 100,
			muted: shown?.muted ?? false
		};
		if (JSON.stringify(next) === JSON.stringify(view)) return;
		view = next;
		for (const listener of listeners) listener(view);
	}

	function flush() {
		sendTimer = undefined;
		if (!pending) return;
		const volume = pending;
		pending = null;
		lastSentAt = Date.now();
		void deps.set(volume.level, volume.muted).then((response) => {
			if (response.ok) return;
			asked = null;
			publish();
		});
	}

	function ask(volume: Volume) {
		asked = volume;
		clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			asked = null;
			publish();
		}, VOLUME_HOLD_MS);
		publish();
		pending = volume;
		const wait = Math.max(0, lastSentAt + VOLUME_SEND_EVERY_MS - Date.now());
		if (sendTimer === undefined) sendTimer = setTimeout(flush, wait);
	}

	const stop = deps.watch((value) => {
		stored = value;
		// The stored value has arrived (or changed on YouTube); it replaces what was asked for.
		asked = null;
		clearTimeout(holdTimer);
		publish();
	});
	deps.read().then(
		(value) => {
			stored = stored ?? value;
			publish();
		},
		() => {}
	);

	return {
		get: () => view,
		subscribe(listener) {
			listeners.add(listener);
			listener(view);
			return () => listeners.delete(listener);
		},
		setLevel(level) {
			const clean = Math.min(100, Math.max(0, Math.round(level)));
			ask({ level: clean, muted: clean > 0 ? false : view.muted });
		},
		toggleMute() {
			if (view.muted) {
				ask({ level: view.level === 0 ? UNMUTE_FROM_ZERO : view.level, muted: false });
			} else {
				ask({ level: view.level, muted: true });
			}
		},
		dispose() {
			stop();
			clearTimeout(holdTimer);
			clearTimeout(sendTimer);
			listeners.clear();
		}
	};
}
