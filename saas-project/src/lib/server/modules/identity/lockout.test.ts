import { describe, expect, it } from 'vitest';
import { lockoutWaitSeconds } from './lockout';

describe('lockoutWaitSeconds', () => {
	it('is zero for the first four failures', () => {
		for (const failures of [0, 1, 2, 3, 4]) expect(lockoutWaitSeconds(failures)).toBe(0);
	});

	it('starts at one minute on the fifth failure and doubles up to 15 minutes', () => {
		const minutes = [5, 6, 7, 8, 9, 10, 50].map((failures) => lockoutWaitSeconds(failures) / 60);

		expect(minutes).toEqual([1, 2, 4, 8, 15, 15, 15]);
	});
});
