// Runs in the browser. Talks to the device's passkey prompt and passes the
// result to the login library at /api/auth/passkey/*.

type PasskeyResult =
	{ ok: true } | { ok: false; reason: 'unsupported' | 'cancelled' | 'refused' | 'relogin' };

type JsonCredential = { toJSON(): unknown };
type PublicKeyHelpers = {
	parseCreationOptionsFromJSON?: (options: unknown) => PublicKeyCredentialCreationOptions;
	parseRequestOptionsFromJSON?: (options: unknown) => PublicKeyCredentialRequestOptions;
};

function helpers(): PublicKeyHelpers | null {
	if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return null;
	return window.PublicKeyCredential as unknown as PublicKeyHelpers;
}

/** Whether this browser can create and use passkeys. */
export function passkeysSupported(): boolean {
	const available = helpers();
	return !!available?.parseCreationOptionsFromJSON && !!available.parseRequestOptionsFromJSON;
}

async function send(path: string, body?: unknown): Promise<Response> {
	return fetch(`/api/auth/passkey/${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

/** Creates a passkey on this device for the signed-in person. */
export async function addPasskey(name: string): Promise<PasskeyResult> {
	const available = helpers();
	if (!available?.parseCreationOptionsFromJSON) return { ok: false, reason: 'unsupported' };

	const options = await send('generate-register-options');
	// The library asks for a recent login before a passkey can be added.
	if (options.status === 401 || options.status === 403) return { ok: false, reason: 'relogin' };
	if (!options.ok) return { ok: false, reason: 'refused' };

	let credential: Credential | null;
	try {
		credential = await navigator.credentials.create({
			publicKey: available.parseCreationOptionsFromJSON(await options.json())
		});
	} catch {
		return { ok: false, reason: 'cancelled' };
	}
	if (!credential) return { ok: false, reason: 'cancelled' };

	const verified = await send('verify-registration', {
		response: (credential as unknown as JsonCredential).toJSON(),
		name: name.trim() || undefined
	});
	return verified.ok ? { ok: true } : { ok: false, reason: 'refused' };
}

/** Signs in with a passkey kept on this device. No email or password is typed. */
export async function signInWithPasskey(): Promise<PasskeyResult> {
	const available = helpers();
	if (!available?.parseRequestOptionsFromJSON) return { ok: false, reason: 'unsupported' };

	const options = await send('generate-authenticate-options');
	if (!options.ok) return { ok: false, reason: 'refused' };

	let credential: Credential | null;
	try {
		credential = await navigator.credentials.get({
			publicKey: available.parseRequestOptionsFromJSON(await options.json())
		});
	} catch {
		return { ok: false, reason: 'cancelled' };
	}
	if (!credential) return { ok: false, reason: 'cancelled' };

	const verified = await send('verify-authentication', {
		response: (credential as unknown as JsonCredential).toJSON()
	});
	return verified.ok ? { ok: true } : { ok: false, reason: 'refused' };
}
