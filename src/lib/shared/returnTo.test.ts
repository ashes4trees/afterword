import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './returnTo';

describe('safeReturnPath', () => {
	it.each([
		['/', '/'],
		['/books?sort=release', '/books?sort=release'],
		['/books/123/timeline', '/books/123/timeline']
	])('keeps the in-app path %s', (input, expected) => {
		expect(safeReturnPath(input)).toBe(expected);
	});

	it.each([
		null,
		'',
		'books',
		'https://evil.example',
		'//evil.example',
		'/\\evil.example',
		'javascript:alert(1)'
	])('rejects %s', (input) => {
		expect(safeReturnPath(input)).toBeNull();
	});
});
