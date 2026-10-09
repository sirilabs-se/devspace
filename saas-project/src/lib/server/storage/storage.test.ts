import { describe, expect, it } from 'vitest';
import { deleteFile, readFile, saveFile } from './index';

const bytes = new Uint8Array([1, 2, 3, 4]);

describe('file storage', () => {
	it('saves a file, reads it back and deletes it', async () => {
		await saveFile('tests/sample-one.bin', bytes);

		expect(await readFile('tests/sample-one.bin')).toEqual(Buffer.from(bytes));

		await deleteFile('tests/sample-one.bin');
		expect(await readFile('tests/sample-one.bin')).toBeNull();
	});

	it('treats deleting a missing file as fine', async () => {
		await expect(deleteFile('tests/never-existed.bin')).resolves.toBeUndefined();
	});

	it('refuses keys that could reach outside the storage folder', async () => {
		for (const key of ['../secret.txt', '/etc/passwd', 'tests/../../x.bin', 'tests\\x.bin', 'x']) {
			await expect(saveFile(key, bytes), key).rejects.toThrow(/Not a valid file key/);
			expect(await readFile(key), key).toBeNull();
		}
	});
});
