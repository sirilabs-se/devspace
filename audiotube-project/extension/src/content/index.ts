import {
	isPlayerReport,
	isTabCommand,
	onMessageToContent,
	readSettings,
	reportOverlayStatus,
	reportPlayer,
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

	// A command from the background is for this tab's player; only the extension itself may send one.
	const onCommand = (message: unknown, sender: chrome.runtime.MessageSender) => {
		if (sender.id !== chrome.runtime.id || sender.tab !== undefined) return;
		if (!isTabCommand(message)) return;
		if (message.type === 'player/seek')
			sendToPage({ type: 'player/seek', positionSec: message.positionSec });
		else sendToPage({ type: 'player/command', command: message.command });
	};
	chrome.runtime.onMessage.addListener(onCommand);
	stops.push(() => chrome.runtime.onMessage.removeListener(onCommand));

	// What the page script says about the player is checked before it goes on; the page can forge messages.
	stops.push(
		onMessageToContent((message) => {
			if (isPlayerReport(message)) void reportPlayer(message);
		}),
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
