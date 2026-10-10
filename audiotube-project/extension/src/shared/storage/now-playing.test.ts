import { describe, expect, it } from 'vitest';
import { CHANNEL_MAX, cleanText, isVideoId, parseNowPlaying, TITLE_MAX } from './now-playing';

const valid = {
	videoId: 'aqz-KE-bpKQ',
	title: 'Big Buck Bunny',
	channel: 'Blender',
	durationSec: 635,
	isLive: false,
	positionSec: 12,
	positionSavedAt: 1_700_000_000_000,
	updatedAt: 1_700_000_000_000
};

describe('isVideoId', () => {
	it('accepts an 11 character id and nothing else', () => {
		expect(isVideoId('aqz-KE-bpKQ')).toBe(true);
		expect(isVideoId('short')).toBe(false);
		expect(isVideoId('aqz-KE-bpKQx')).toBe(false);
		expect(isVideoId('aqz KE bpKQ')).toBe(false);
		expect(isVideoId(123)).toBe(false);
	});
});

describe('cleanText', () => {
	it('caps the length by characters, not code units', () => {
		expect(cleanText('x'.repeat(500), TITLE_MAX)).toHaveLength(TITLE_MAX);
		expect(Array.from(cleanText('😀'.repeat(150), CHANNEL_MAX))).toHaveLength(CHANNEL_MAX);
	});

	it('drops control characters and collapses whitespace', () => {
		expect(cleanText('  a\u0000b \n\n c  ', 50)).toBe('a b c');
	});

	it('keeps markup as text, untouched', () => {
		expect(cleanText('<img src=x onerror=alert(1)>', 50)).toBe('<img src=x onerror=alert(1)>');
	});

	it('reads anything that is not text as empty', () => {
		expect(cleanText(undefined, 10)).toBe('');
		expect(cleanText({ a: 1 }, 10)).toBe('');
	});
});

describe('parseNowPlaying', () => {
	it('reads a valid value', () => {
		expect(parseNowPlaying(valid)).toEqual(valid);
	});

	it('reads missing or invalid values as nothing playing', () => {
		expect(parseNowPlaying(undefined)).toBeNull();
		expect(parseNowPlaying('x')).toBeNull();
		expect(parseNowPlaying({ ...valid, videoId: 'nope' })).toBeNull();
		expect(parseNowPlaying({ ...valid, updatedAt: 'yesterday' })).toBeNull();
		expect(parseNowPlaying({ ...valid, positionSavedAt: undefined })).toBeNull();
	});

	it('cuts a title or channel longer than the cap', () => {
		const read = parseNowPlaying({ ...valid, title: 'T'.repeat(400), channel: 'C'.repeat(200) })!;
		expect(read.title).toHaveLength(TITLE_MAX);
		expect(read.channel).toHaveLength(CHANNEL_MAX);
	});

	it('has no duration for a live stream', () => {
		expect(parseNowPlaying({ ...valid, isLive: true, durationSec: 100 })!.durationSec).toBeNull();
	});

	it('falls back for a bad position or duration without rejecting the whole value', () => {
		const read = parseNowPlaying({ ...valid, positionSec: -4, durationSec: 'long' })!;
		expect(read.positionSec).toBe(0);
		expect(read.durationSec).toBeNull();
	});
});
