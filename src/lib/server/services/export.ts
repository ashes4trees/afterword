import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { authorRow, tableRows, TENANT_TABLES, type ExportRow } from '$lib/server/repo/export';
import { toCsv } from '$lib/shared/csv';
import { zipFiles } from '$lib/server/zip';

// Full data export (#17): everything that belongs to the author, as one JSON file, or a
// zip of one CSV per table for spreadsheets. Nobody should be trapped in a side project.

export const EXPORT_FORMAT = 'afterword-export';
export const EXPORT_VERSION = 1;

export type AccountExport = {
	format: typeof EXPORT_FORMAT;
	version: number;
	exported_at: string;
	author: ExportRow;
	tables: Record<string, ExportRow[]>;
};

export function exportAccount(db: Executor, author: SessionAuthor): Promise<AccountExport> {
	return withAuthor(db, author.id, async (tx) => {
		const tables: Record<string, ExportRow[]> = {};
		for (const t of TENANT_TABLES) tables[t.name] = await tableRows(tx, author.id, t.name);
		return {
			format: EXPORT_FORMAT,
			version: EXPORT_VERSION,
			exported_at: new Date().toISOString(),
			author: (await authorRow(tx, author.id))!,
			tables
		};
	});
}

/** The same export as a zip: export.json, plus one CSV per table (and the account). */
export async function exportAccountZip(db: Executor, author: SessionAuthor) {
	const data = await exportAccount(db, author);
	const files = [
		{ name: 'export.json', data: JSON.stringify(data, null, 2) },
		{ name: 'account.csv', data: toCsv(Object.keys(data.author), [data.author]) },
		...TENANT_TABLES.map((t) => ({
			name: `${t.name}.csv`,
			data: toCsv(t.columns, data.tables[t.name] ?? [])
		}))
	];
	return zipFiles(files);
}
