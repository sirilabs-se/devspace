import type { PlayerReport, PlayerVideoDetails, PlayState } from '../shared';

export const POSITION_EVERY_MS = 5000;

/** What the player shows right now, already reduced to what is reported. */
export interface PlayerSnapshot extends PlayerVideoDetails {
	state: PlayState;
	positionSec: number;
	adPlaying: boolean;
}

export interface ReporterDeps {
	/** The main player's snapshot, or null when there is no main player on this page. */
	read: () => PlayerSnapshot | null;
	send: (report: PlayerReport) => void;
	now: () => number;
}

/** YouTube's player state numbers: 1 playing, 2 paused, 3 buffering, 0 ended. Anything else is not playing. */
export function playStateFromNumber(value: unknown): PlayState {
	if (value === 1) return 'playing';
	if (value === 3) return 'buffering';
	if (value === 0) return 'ended';
	return 'paused';
}

/**
 * Reports changes: a new video (or new details), a new play state, and the position every few seconds while
 * playing. Call `check` on any sign something may have changed and on a regular beat.
 */
export function createReporter(deps: ReporterDeps) {
	let videoKey: string | null = null;
	let state: PlayState | null = null;
	let positionSentAt = 0;

	return {
		check() {
			const snapshot = deps.read();
			if (!snapshot) {
				videoKey = null;
				state = null;
				return;
			}
			const now = deps.now();
			const key = JSON.stringify([
				snapshot.videoId,
				snapshot.title,
				snapshot.channel,
				snapshot.durationSec,
				snapshot.isLive
			]);

			const videoChanged = key !== videoKey;
			if (videoChanged) {
				videoKey = key;
				deps.send({
					type: 'player/video',
					videoId: snapshot.videoId,
					title: snapshot.title,
					channel: snapshot.channel,
					durationSec: snapshot.durationSec,
					isLive: snapshot.isLive
				});
			}

			// Ad time is not the video's position, so it is never reported as one.
			const positionSec = snapshot.adPlaying ? 0 : snapshot.positionSec;
			if (videoChanged || snapshot.state !== state) {
				state = snapshot.state;
				positionSentAt = now;
				deps.send({ type: 'player/state', state: snapshot.state, positionSec });
				return;
			}
			if (
				snapshot.state === 'playing' &&
				!snapshot.adPlaying &&
				now - positionSentAt >= POSITION_EVERY_MS
			) {
				positionSentAt = now;
				deps.send({ type: 'player/position', positionSec });
			}
		}
	};
}
