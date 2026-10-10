import { listenForRequests } from './message-handler';

listenForRequests();
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
