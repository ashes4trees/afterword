import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { zipFiles } from './zip';

const hasUnzip = (() => {
	try {
		execFileSync('unzip', ['-v'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
})();

describe.skipIf(!hasUnzip)('zipFiles', () => {
	it('writes a zip that a standard unzip tool reads back exactly', () => {
		const dir = mkdtempSync(join(tmpdir(), 'afterword-zip-'));
		try {
			const path = join(dir, 'test.zip');
			const text = 'title,penName\r\n"Salt, Lantern",A. Vale — ✓\r\n'.repeat(50);
			writeFileSync(
				path,
				zipFiles([
					{ name: 'titles.csv', data: text },
					{ name: 'empty.csv', data: '' }
				])
			);
			execFileSync('unzip', ['-t', path], { stdio: 'ignore' });
			expect(execFileSync('unzip', ['-p', path, 'titles.csv']).toString()).toBe(text);
			expect(execFileSync('unzip', ['-Z1', path]).toString().split('\n').filter(Boolean)).toEqual([
				'titles.csv',
				'empty.csv'
			]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
