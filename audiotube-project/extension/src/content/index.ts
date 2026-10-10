import {
	onMessageToContent,
	readSettings,
	reportOverlayStatus,
	requestSetAudioOnly,
	sendToPage,
	watchSettings
} from '../shared';
import { startControlButtonController } from './control-button-controller';
import { startCoverStatusController } from './cover-status-controller';
import { isExtensionAlive, removeLeftovers } from './lifecycle';
import { onPageChange } from './page-changes';
import { startOverlayController } from './overlay-controller';
import { startPipController } from './pip-controller';
import { startQualityController } from './quality-controller';
import { startVisibilityFlag } from './visibility';
import { findPlayerToCover, isWatchPath } from './watch-page';

const GUARD = '__audiotubeContentStarted';
const scope = globalThis as unknown as Record<string, boolean>;
const WATCHDOG_MS = 1000;

// The script can be injected twice (manifest and on install); only the first copy runs.
if (!scope[GUARD]) {
	scope[GUARD] = true;

	// A copy from before an update may still be on the page, cut off from the extension.
	removeLeftovers(document);

	const stops: (() => void)[] = [];
	const watchdog = setInterval(() => {
		if (!isExtensionAlive()) shutdown();
	}, WATCHDOG_MS);

	function shutdown() {
		clearInterval(watchdog);
		for (const stop of stops.splice(0)) stop();
	}

	const request = (value: boolean) => async () => {
		const response = await requestSetAudioOnly(value);
		if (!response.ok && !isExtensionAlive()) shutdown();
		return response.ok;
	};

	stops.push(
		startVisibilityFlag(
			{ read: readSettings, watch: watchSettings },
			document.documentElement,
			crypto.randomUUID()
		),
		startOverlayController({
			read: readSettings,
			watch: watchSettings,
			requestShowVideo: request(false),
			togglePlayback: () => sendToPage({ type: 'player/toggle-playback' })
		}),
		startPipController({ read: readSettings, watch: watchSettings }),
		startCoverStatusController({
			read: readSettings,
			watch: watchSettings,
			onWatchPage: () => isWatchPath(location.pathname),
			playerPresent: () => findPlayerToCover(document, location.pathname) !== null,
			report: (status) => void reportOverlayStatus(status),
			onPageChange
		}),
		startControlButtonController({
			read: readSettings,
			watch: watchSettings,
			requestAudioOnly: request(true)
		}),
		startQualityController({
			read: readSettings,
			watch: watchSettings,
			send: sendToPage,
			onPageReady: (handler) =>
				onMessageToContent((message) => message.type === 'quality/ready' && handler())
		})
	);
}
