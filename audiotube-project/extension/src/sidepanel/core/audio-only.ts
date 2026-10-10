import {
	DEFAULT_SETTINGS,
	readSettings,
	requestSetAudioOnly,
	watchSettings,
	type SetAudioOnlyResponse,
	type Settings
} from '../../shared';

export type AudioOnlyError = 'save-failed' | 'load-failed';

export interface AudioOnlyView {
	/** False until the saved value has been read, so the panel never flashes the wrong position. */
	ready: boolean;
	audioOnly: boolean;
	error: AudioOnlyError | null;
}

export interface AudioOnlyController {
	get(): AudioOnlyView;
	/** Calls `listener` now and on every change. Returns a function that stops it. */
	subscribe(listener: (view: AudioOnlyView) => void): () => void;
	toggle(): void;
	set(value: boolean): Promise<void>;
	dispose(): void;
}

export interface AudioOnlyDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
	request: (value: boolean) => Promise<SetAudioOnlyResponse>;
}

const ERROR_VISIBLE_MS = 6000;

export function createAudioOnlyController(
	deps: AudioOnlyDeps = { read: readSettings, watch: watchSettings, request: requestSetAudioOnly }
): AudioOnlyController {
	let view: AudioOnlyView = { ready: false, audioOnly: DEFAULT_SETTINGS.audioOnly, error: null };
	let saved = DEFAULT_SETTINGS.audioOnly;
	let busy = false;
	let clearTimer: ReturnType<typeof setTimeout> | undefined;
	const listeners = new Set<(view: AudioOnlyView) => void>();

	function update(patch: Partial<AudioOnlyView>) {
		view = { ...view, ...patch };
		for (const listener of listeners) listener(view);
	}

	function showError(error: AudioOnlyError) {
		clearTimeout(clearTimer);
		update({ error });
		clearTimer = setTimeout(() => update({ error: null }), ERROR_VISIBLE_MS);
	}

	// Watch before reading, so a change made between the two is never missed.
	const stopWatching = deps.watch((settings) => {
		saved = settings.audioOnly;
		update({ ready: true, audioOnly: settings.audioOnly });
	});

	deps.read().then(
		(settings) => {
			if (view.ready) return;
			saved = settings.audioOnly;
			update({ ready: true, audioOnly: settings.audioOnly });
		},
		() => {
			if (view.ready) return;
			update({ ready: true });
			showError('load-failed');
		}
	);

	async function set(value: boolean) {
		if (busy || !view.ready) return;
		busy = true;
		clearTimeout(clearTimer);
		update({ audioOnly: value, error: null });
		const response = await deps.request(value);
		busy = false;
		if (response.ok) {
			saved = response.audioOnly;
			update({ audioOnly: saved });
		} else {
			update({ audioOnly: saved });
			showError('save-failed');
		}
	}

	return {
		get: () => view,
		subscribe(listener) {
			listeners.add(listener);
			listener(view);
			return () => listeners.delete(listener);
		},
		toggle: () => void set(!view.audioOnly),
		set,
		dispose() {
			stopWatching();
			clearTimeout(clearTimer);
			listeners.clear();
		}
	};
}
