export interface Settings {
	audioOnly: boolean;
	saveBandwidth: boolean;
}

export type SettingKey = keyof Settings;

export const SETTING_KEYS = ['audioOnly', 'saveBandwidth'] as const satisfies readonly SettingKey[];

export const DEFAULT_SETTINGS: Readonly<Settings> = { audioOnly: true, saveBandwidth: true };

export function isSettingKey(value: unknown): value is SettingKey {
	return typeof value === 'string' && (SETTING_KEYS as readonly string[]).includes(value);
}

export function isValidSettingValue<K extends SettingKey>(
	_key: K,
	value: unknown
): value is Settings[K] {
	return typeof value === 'boolean';
}

/** A missing or invalid stored value reads as that setting's default; other settings are unaffected. */
export function parseSettings(raw: Record<string, unknown> | undefined): Settings {
	const settings: Settings = { ...DEFAULT_SETTINGS };
	for (const key of SETTING_KEYS) {
		const value = raw?.[key];
		if (isValidSettingValue(key, value)) settings[key] = value;
	}
	return settings;
}
