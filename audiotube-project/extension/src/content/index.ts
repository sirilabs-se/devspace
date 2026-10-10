import {
	onMessageToContent,
	readSettings,
	requestSetAudioOnly,
	sendToPage,
	watchSettings
} from '../shared';
import { startControlButtonController } from './control-button-controller';
import { startOverlayController } from './overlay-controller';
import { startQualityController } from './quality-controller';

const GUARD = '__audiotubeContentStarted';
const scope = globalThis as unknown as Record<string, boolean>;

// The script can be injected twice (manifest and on install); only the first copy runs.
if (!scope[GUARD]) {
	scope[GUARD] = true;
	startOverlayController({
		read: readSettings,
		watch: watchSettings,
		requestShowVideo: () => void requestSetAudioOnly(false)
	});
	startControlButtonController({
		read: readSettings,
		watch: watchSettings,
		requestAudioOnly: () => void requestSetAudioOnly(true)
	});
	startQualityController({
		read: readSettings,
		watch: watchSettings,
		send: sendToPage,
		onPageReady: (handler) =>
			onMessageToContent((message) => message.type === 'quality/ready' && handler())
	});
}
