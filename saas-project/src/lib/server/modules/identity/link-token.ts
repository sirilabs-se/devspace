/** What a verification link token says. Read only for wording and records; the library checks the token itself. */
export type LinkTokenPayload = { email?: string; updateTo?: string; requestType?: string };

export function linkTokenPayload(token: string): LinkTokenPayload | null {
	try {
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
		return typeof payload === 'object' && payload !== null ? payload : null;
	} catch {
		return null;
	}
}
