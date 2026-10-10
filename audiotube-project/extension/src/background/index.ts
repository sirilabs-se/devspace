import { readSettings, watchSettings } from '../shared';
import { keepEarlyCssInStep } from './early-css';
import { listenForRequests } from './message-handler';
import { forgetStatusesOfGoneTabs } from './overlay-status';
import { checkPlaybackTab, watchPlaybackTabLoss } from './playback';
import { injectIntoOpenTabs } from './open-tabs';

listenForRequests();
forgetStatusesOfGoneTabs();
watchPlaybackTabLoss();
void checkPlaybackTab();
keepEarlyCssInStep(readSettings, watchSettings);
chrome.runtime.onInstalled.addListener(() => void injectIntoOpenTabs());
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
