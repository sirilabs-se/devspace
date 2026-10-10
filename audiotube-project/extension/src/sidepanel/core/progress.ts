import type { NowPlaying, PlaybackTab } from '../../shared';

export interface Progress {
	/** A live stream has no duration and nothing to count to. */
	live: boolean;
	buffering: boolean;
	elapsedSec: number;
	durationSec: number | null;
	remainingSec: number | null;
	/** 0 to 1, or null for a live stream. */
	fraction: number | null;
	elapsedText: string;
	remainingText: string | null;
}

export function formatClock(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	const two = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/**
 * Where the video is now. While the playback tab is playing, the position is counted forward from the
 * snapshot the background keeps (ADR 0007); in every other state it is the snapshot itself. With no playback
 * tab it is the saved position, and it does not move. Kept between 0 and the duration.
 */
export function computeProgress(
	video: Pick<NowPlaying, 'positionSec' | 'durationSec' | 'isLive'>,
	tab: PlaybackTab | null,
	now: number
): Progress {
	let position = video.positionSec;
	if (tab) {
		position = tab.positionSec;
		if (tab.state === 'playing') position += ((now - tab.stateAt) / 1000) * tab.rate;
	}
	const buffering = tab?.state === 'buffering';

	if (video.isLive) {
		return {
			live: true,
			buffering,
			elapsedSec: 0,
			durationSec: null,
			remainingSec: null,
			fraction: null,
			elapsedText: '',
			remainingText: null
		};
	}

	const duration = video.durationSec;
	const clamped = Math.max(0, duration === null ? position : Math.min(position, duration));
	const elapsedSec = Math.floor(clamped);
	const remainingSec = duration === null ? null : Math.max(0, duration - elapsedSec);
	return {
		live: false,
		buffering,
		elapsedSec,
		durationSec: duration,
		remainingSec,
		fraction: duration !== null && duration > 0 ? Math.min(1, clamped / duration) : null,
		elapsedText: formatClock(elapsedSec),
		remainingText: remainingSec === null ? null : formatClock(remainingSec)
	};
}
