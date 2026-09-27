import { describe, expect, it } from 'vitest';
import { isCurrent } from './nav';

describe('isCurrent', () => {
	it('matches a section and its subpages', () => {
		expect(isCurrent('/books', '/books')).toBe(true);
		expect(isCurrent('/books', '/books/123')).toBe(true);
	});

	it('does not match a section that only shares a prefix', () => {
		expect(isCurrent('/ads', '/adsense')).toBe(false);
	});

	it('matches home only exactly', () => {
		expect(isCurrent('/', '/', true)).toBe(true);
		expect(isCurrent('/', '/books', true)).toBe(false);
	});
});
