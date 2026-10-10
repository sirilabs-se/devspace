import { listenForRequests } from './message-handler';
import { injectIntoOpenTabs } from './open-tabs';

listenForRequests();
chrome.runtime.onInstalled.addListener(() => void injectIntoOpenTabs());
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
