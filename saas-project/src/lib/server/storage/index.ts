import { mkdir, readFile as readFromDisk, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// Stores uploaded files. No provider is chosen yet, so the only way of storing
// is on the local disk, in the folder named by STORAGE_DIR.

// A file's key is its folder and name, e.g. "avatars/1b4e28ba-….png".
const KEY_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+)*\.[a-z0-9]+$/;

function storageDir(): string {
	const driver = env.STORAGE_DRIVER ?? (dev ? 'local' : undefined);
	if (driver !== 'local') {
		throw new Error('No file storage is set up. Set STORAGE_DRIVER=local and STORAGE_DIR.');
	}
	return path.resolve(env.STORAGE_DIR ?? '.data/uploads');
}

function filePath(key: string): string {
	if (!KEY_PATTERN.test(key)) throw new Error(`Not a valid file key: ${key}`);
	return path.join(storageDir(), key);
}

export async function saveFile(key: string, bytes: Uint8Array): Promise<void> {
	const target = filePath(key);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, bytes);
}

/** Returns the file's bytes, or null if there is no such file. */
export async function readFile(key: string): Promise<Uint8Array | null> {
	if (!KEY_PATTERN.test(key)) return null;
	try {
		return await readFromDisk(filePath(key));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

/** Deletes the file. Deleting a file that isn't there is not an error. */
export async function deleteFile(key: string): Promise<void> {
	await rm(filePath(key), { force: true });
}
