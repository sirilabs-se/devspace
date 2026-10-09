/**
 * Turns a browser's self-description into a few plain words, e.g. "Chrome on
 * Windows". Only a rough guide for the person reading their own activity.
 */
export function describeDevice(userAgent: string | null): string {
	if (!userAgent) return 'Unknown device';

	const browser =
		[
			[/Edg\//, 'Edge'],
			[/OPR\/|Opera/, 'Opera'],
			[/Firefox\//, 'Firefox'],
			[/Chrome\/|CriOS\//, 'Chrome'],
			[/Safari\//, 'Safari']
		].find(([pattern]) => (pattern as RegExp).test(userAgent))?.[1] ?? null;

	const system =
		[
			[/iPhone|iPad|iPod/, 'iOS'],
			[/Android/, 'Android'],
			[/Windows/, 'Windows'],
			[/Mac OS X|Macintosh/, 'macOS'],
			[/Linux/, 'Linux']
		].find(([pattern]) => (pattern as RegExp).test(userAgent))?.[1] ?? null;

	if (browser && system) return `${browser} on ${system}`;
	return (browser ?? system ?? 'Unknown device') as string;
}
