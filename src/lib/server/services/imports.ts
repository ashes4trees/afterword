import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { parseKdpReport } from '$lib/server/import/kdp';
import type { ParsedReport } from '$lib/server/import/types';
import { ImportError, readWorkbook } from '$lib/server/import/xlsx';
import type { SessionAuthor } from '$lib/server/repo/authors';
import * as importsRepo from '$lib/server/repo/imports';
import * as listingsRepo from '$lib/server/repo/listings';
import * as works from '$lib/server/repo/works';
import type { Metric } from '$lib/shared/observations';

// Report imports (#21, C3): file upload only, parsed in memory and never stored. Only the
// observations are kept. An upload replaces what earlier uploads of the same report said
// about the days it covers, so overlapping reports never double count.

export type ImportSummary =
	| {
			ok: true;
			rows: number;
			coverage: ParsedReport['coverage'];
			/** Books in the file matched to the author's listings by store ID. */
			matched: { title: string; externalId: string }[];
			/** Books in the file with no listing carrying their store ID yet. */
			unmatched: { title: string; externalId: string; format: string | null }[];
	  }
	| { ok: false; error: string };

export async function importReport(
	db: Executor,
	author: SessionAuthor,
	filename: string,
	bytes: Uint8Array
): Promise<ImportSummary> {
	let report: ParsedReport;
	try {
		report = parseKdpReport(readWorkbook(bytes));
	} catch (e) {
		if (!(e instanceof ImportError)) throw e;
		await withAuthor(db, author.id, async (tx) => {
			const id = await importsRepo.createImport(tx, author.id, {
				channelSlug: 'kdp',
				kind: 'kdp_report',
				filename: filename.slice(0, 255)
			});
			await importsRepo.finishImport(tx, author.id, id, { error: e.message });
		});
		return { ok: false, error: e.message };
	}

	return withAuthor(db, author.id, async (tx) => {
		const listings = (await listingsRepo.listListings(tx, author.id)).filter((l) => l.externalId);
		const titles = new Map(
			(await works.listTitles(tx, author.id)).map((t) => [t.id, t.workingTitle])
		);
		const bookFor = new Map(listings.map((l) => [l.externalId!.trim(), l.titleId]));

		const id = await importsRepo.createImport(tx, author.id, {
			channelSlug: report.channel,
			kind: report.kind,
			filename: filename.slice(0, 255)
		});
		for (const [metric, range] of Object.entries(report.coverage)) {
			await importsRepo.deleteImportedCoverage(
				tx,
				author.id,
				report.kind,
				metric as Metric,
				range.from,
				range.to
			);
		}
		await importsRepo.insertObservations(
			tx,
			author.id,
			id,
			report.observations.map((o) => ({
				titleId: bookFor.get(o.externalId) ?? null,
				externalId: o.externalId || null,
				format: o.format,
				channelSlug: report.channel,
				marketplace: o.marketplace,
				currency: o.currency,
				metric: o.metric,
				value: o.value,
				periodStart: o.periodStart,
				periodEnd: o.periodEnd
			}))
		);
		await importsRepo.finishImport(tx, author.id, id, { rowCount: report.observations.length });

		const matched = report.books
			.filter((b) => bookFor.has(b.externalId))
			.map((b) => ({
				title: titles.get(bookFor.get(b.externalId)!) ?? b.title,
				externalId: b.externalId
			}));
		const unmatched = report.books
			.filter((b) => b.externalId && !bookFor.has(b.externalId))
			.map((b) => ({ title: b.title, externalId: b.externalId, format: b.format }));
		return {
			ok: true,
			rows: report.observations.length,
			coverage: report.coverage,
			matched,
			unmatched
		};
	});
}

export function listImports(db: Executor, author: SessionAuthor) {
	return withAuthor(db, author.id, (tx) => importsRepo.listImportsWithCounts(tx, author.id));
}

/** Deletes an import and the numbers it brought in. */
export function deleteImport(db: Executor, author: SessionAuthor, id: string) {
	return withAuthor(db, author.id, (tx) => importsRepo.deleteImport(tx, author.id, id));
}
