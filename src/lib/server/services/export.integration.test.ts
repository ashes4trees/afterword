import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { TENANT_TABLES } from '$lib/server/repo/export';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { restoreAccount } from '$lib/server/testing/restore';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import { exportAccount, exportAccountZip } from './export';
import { saveListing } from './listings';
import { updatePreferences } from '$lib/server/repo/authors';
import { addOwnStep, saveMyIdea, setIdeaHidden } from './tasks';

describe.skipIf(!hasDatabase)('full data export (#17)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `export-${tag}@example.test`, displayName: 'Export Me' },
				{ email: `export-other-${tag}@example.test`, displayName: 'Other' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];

		// Something in every tenant table.
		await updatePreferences(app.db, me.id, { hide_overdue: true });
		const book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({
				...EMPTY_TITLE_FORM,
				workingTitle: 'The Salt Lantern',
				penName: 'A. Vale',
				seriesTitle: 'Lantern Cycle',
				seriesPosition: '1',
				tropes: 'found family, slow burn',
				releaseDate: '2027-02-01',
				formats: 'ebook,paperback'
			}),
			['kdp']
		);
		const base = {
			status: 'live' as const,
			externalId: 'B0EXPORT',
			priceMinor: 499,
			currency: 'USD',
			enrolledInSelect: true,
			exclusivityStart: '2026-10-01',
			exclusivityEnd: '2026-12-30',
			wholesaleDiscountPct: null,
			returnable: null
		};
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, base);
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, {
			...base,
			exclusivityEnd: '2027-03-30'
		});
		await addOwnStep(app.db, me, book, 'Email the street team', '2027-01-20', {
			phase: 'prelaunch'
		});
		await saveMyIdea(app.db, me, null, {
			label: 'Live read',
			note: 'First chapter, = twenty minutes',
			phase: 'launch',
			window: { from_days: 0, to_days: 7 },
			repeatable: true
		});
		await setIdeaHidden(
			app.db,
			me,
			book,
			{ pack: 'title/promo-ideas', stepId: 'mood-board' },
			true
		);
		await createBook(
			app.db,
			other,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'Not yours' })
		);
	});

	afterAll(async () => {
		await owner.db.delete(authors).where(eq(authors.id, me.id));
		await owner.db.delete(authors).where(eq(authors.id, other.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('covers every tenant table, with only this author’s rows', async () => {
		const data = await exportAccount(app.db, me);
		expect(Object.keys(data.tables).sort()).toEqual(TENANT_TABLES.map((t) => t.name));
		for (const t of TENANT_TABLES) {
			expect(data.tables[t.name]!.length, `${t.name} needs a fixture row`).toBeGreaterThan(0);
			expect(data.tables[t.name]!.every((r) => r.author_id === me.id)).toBe(true);
		}
		expect(data.author).toMatchObject({ email: me.email, preferences: { hide_overdue: true } });
		expect(JSON.stringify(data)).not.toContain('Not yours');
	});

	it('round-trips: deleting the account and restoring the export gives the same export', async () => {
		const before = await exportAccount(app.db, me);
		await owner.db.delete(authors).where(eq(authors.id, me.id));
		expect((await exportAccount(app.db, me)).tables.titles).toEqual([]);
		await restoreAccount(owner.db, before);
		const after = await exportAccount(app.db, me);
		expect({ ...after, exported_at: null }).toEqual({ ...before, exported_at: null });
	});

	it('zips the same data as CSV per table, plus the JSON', async () => {
		const zip = Buffer.from(await exportAccountZip(app.db, me));
		// File names from the zip's central directory entries.
		const names: string[] = [];
		const entry = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
		for (let at = zip.indexOf(entry); at !== -1; at = zip.indexOf(entry, at + 46)) {
			names.push(zip.toString('utf8', at + 46, at + 46 + zip.readUInt16LE(at + 28)));
		}
		expect(names).toEqual([
			'export.json',
			'account.csv',
			...TENANT_TABLES.map((t) => `${t.name}.csv`)
		]);
	});
});
