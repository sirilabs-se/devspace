import { mount } from 'svelte';
import { createAudioOnlyController, createCoverStatusController } from './core';
import { App } from './ui';

mount(App, {
	target: document.getElementById('app')!,
	props: {
		audioOnly: createAudioOnlyController(),
		coverStatus: createCoverStatusController()
	}
});
