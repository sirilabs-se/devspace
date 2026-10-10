import { createHmac } from 'node:crypto';

// Works out the 6-digit code an authenticator app would show, so tests can
// play the part of the app. The standard method (RFC 6238): 30-second steps, SHA-1.

function base32Decode(text: string): Buffer {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = '';
	for (const character of text.replace(/=+$/, '').toUpperCase()) {
		const value = alphabet.indexOf(character);
		if (value === -1) throw new Error(`Not base32: ${character}`);
		bits += value.toString(2).padStart(5, '0');
	}
	const bytes = bits.match(/.{8}/g) ?? [];
	return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

/** The current code for a set-up key, or the code some 30-second steps away from now. */
export function authenticatorCode(setupKey: string, stepsFromNow = 0): string {
	const counter = Math.floor(Date.now() / 1000 / 30) + stepsFromNow;
	const message = Buffer.alloc(8);
	message.writeBigUInt64BE(BigInt(counter));

	const digest = createHmac('sha1', base32Decode(setupKey)).update(message).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return String(number).padStart(6, '0');
}
