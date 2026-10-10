import { readSettings, watchSettings } from '../shared';
import { keepEarlyCssInStep } from './early-css';
import { listenForRequests } from './message-handler';
import { forgetStatusesOfGoneTabs } from './overlay-status';
import { forgetVideosOfGoneTabs } from './playback';
import { injectIntoOpenTabs } from './open-tabs';

listenForRequests();
forgetStatusesOfGoneTabs();
forgetVideosOfGoneTabs();
keepEarlyCssInStep(readSettings, watchSettings);
chrome.runtime.onInstalled.addListener(() => void injectIntoOpenTabs());
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
