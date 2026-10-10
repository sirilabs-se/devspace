import { mount } from 'svelte';
import {
	createAudioOnlyController,
	createCoverStatusController,
	createNowPlayingController
} from './core';
import { App } from './ui';

mount(App, {
	target: document.getElementById('app')!,
	props: {
		audioOnly: createAudioOnlyController(),
		coverStatus: createCoverStatusController(),
		nowPlaying: createNowPlayingController()
	}
});
