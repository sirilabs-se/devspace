export {
	DEFAULT_SETTINGS,
	isSettingKey,
	isValidSettingValue,
	parseSettings,
	SETTING_KEYS,
	type SettingKey,
	type Settings
} from './settings/schema';
export { readSettings, watchSettings } from './settings/read';
export {
	isBackgroundRequest,
	requestSetAudioOnly,
	type BackgroundRequest,
	type SetAudioOnlyRequest,
	type SetAudioOnlyResponse,
	type SettingsError
} from './messages';
