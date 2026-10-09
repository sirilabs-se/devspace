import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { users } from './schema';
import { checkUsernameAvailable, usernameFormatProblem } from './username';

beforeEach(async () => {
	await resetDatabase();
});

describe('usernameFormatProblem', () => {
	it('accepts letters, numbers, dots, hyphens and underscores, 3 to 30 long', () => {
		expect(usernameFormatProblem('anna')).toBeNull();
		expect(usernameFormatProblem('Anna_Berg-42')).toBeNull();
		expect(usernameFormatProblem('maya.okafor')).toBeNull();
		expect(usernameFormatProblem('abc')).toBeNull();
		expect(usernameFormatProblem('a'.repeat(30))).toBeNull();
	});

	it('rejects names that are too short, too long or use other characters', () => {
		expect(usernameFormatProblem('ab')).toBe('invalid');
		expect(usernameFormatProblem('a'.repeat(31))).toBe('invalid');
		expect(usernameFormatProblem('anna berg')).toBe('invalid');
		expect(usernameFormatProblem('ånna')).toBe('invalid');
		expect(usernameFormatProblem('')).toBe('invalid');
	});

	it('rejects names that start or end with a dot, hyphen or underscore', () => {
		expect(usernameFormatProblem('.maya')).toBe('invalid');
		expect(usernameFormatProblem('maya.')).toBe('invalid');
		expect(usernameFormatProblem('-maya')).toBe('invalid');
		expect(usernameFormatProblem('maya_')).toBe('invalid');
	});

	it('rejects reserved names in any letter case', () => {
		expect(usernameFormatProblem('admin')).toBe('reserved');
		expect(usernameFormatProblem('Support')).toBe('reserved');
		expect(usernameFormatProblem('HELP')).toBe('reserved');
	});
});

describe('checkUsernameAvailable', () => {
	it('says a free name is available', async () => {
		expect(await checkUsernameAvailable('anna')).toEqual({ available: true });
	});

	it('says why a name is not available', async () => {
		await db
			.insert(users)
			.values({ id: 'user-1', email: 'anna@example.com', name: 'Anna', username: 'anna' });

		expect(await checkUsernameAvailable('Anna')).toEqual({ available: false, reason: 'taken' });
		expect(await checkUsernameAvailable('admin')).toEqual({ available: false, reason: 'reserved' });
		expect(await checkUsernameAvailable('a')).toEqual({ available: false, reason: 'invalid' });
	});
});
