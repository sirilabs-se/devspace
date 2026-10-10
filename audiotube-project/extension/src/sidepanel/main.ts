import { mount } from 'svelte';
import { createAudioOnlyController } from './core';
import { App } from './ui';

mount(App, {
	target: document.getElementById('app')!,
	props: { audioOnly: createAudioOnlyController() }
});
