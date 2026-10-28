import { inflateRawSync } from 'node:zlib';

// A small, defensive XLSX reader for report uploads (#21, C3). Reports come from
// strangers, so it caps the file, the number of entries, and how far they unzip (no zip
// bombs), and reads XML with plain patterns: no DTDs, no entity expansion beyond the five
// standard ones and numeric references. It reads cell values only, never formulas.

export class ImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImportError';
	}
}

export const LIMITS = {
	fileBytes: 10 * 1024 * 1024,
	entries: 200,
	unzippedBytes: 60 * 1024 * 1024
};

const NOT_A_SPREADSHEET =
	"This file isn't a spreadsheet Afterword can read. Upload the .xlsx file as it came from the store.";

/** Entries of a zip archive, by name, unzipped. */
export function readZip(bytes: Uint8Array): Map<string, Buffer> {
	if (bytes.byteLength > LIMITS.fileBytes)
		throw new ImportError('That file is too big. Reports are usually well under 10 MB.');
	const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// The end-of-central-directory record sits in the last 22 bytes plus any comment.
	let end = -1;
	for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) {
			end = i;
			break;
		}
	}
	if (end < 0) throw new ImportError(NOT_A_SPREADSHEET);
	const count = buf.readUInt16LE(end + 10);
	if (count > LIMITS.entries) throw new ImportError(NOT_A_SPREADSHEET);
	let at = buf.readUInt32LE(end + 16);
	const files = new Map<string, Buffer>();
	let total = 0;
	for (let n = 0; n < count; n++) {
		if (at + 46 > buf.length || buf.readUInt32LE(at) !== 0x02014b50)
			throw new ImportError(NOT_A_SPREADSHEET);
		const method = buf.readUInt16LE(at + 10);
		const packed = buf.readUInt32LE(at + 20);
		const size = buf.readUInt32LE(at + 24);
		const nameLength = buf.readUInt16LE(at + 28);
		const extra = buf.readUInt16LE(at + 30);
		const comment = buf.readUInt16LE(at + 32);
		const local = buf.readUInt32LE(at + 42);
		const name = buf.toString('utf8', at + 46, at + 46 + nameLength);
		at += 46 + nameLength + extra + comment;
		total += size;
		if (total > LIMITS.unzippedBytes)
			throw new ImportError('That file unpacks to far more than a report should.');
		if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50)
			throw new ImportError(NOT_A_SPREADSHEET);
		const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
		const data = buf.subarray(start, start + packed);
		if (method === 0) files.set(name, data);
		else if (method === 8) {
			try {
				files.set(name, inflateRawSync(data, { maxOutputLength: Math.max(size, 1) }));
			} catch {
				throw new ImportError(NOT_A_SPREADSHEET);
			}
		} else throw new ImportError(NOT_A_SPREADSHEET);
	}
	return files;
}

const unescape = (s: string) =>
	s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
		e === 'amp'
			? '&'
			: e === 'lt'
				? '<'
				: e === 'gt'
					? '>'
					: e === 'quot'
						? '"'
						: e === 'apos'
							? "'"
							: String.fromCodePoint(
									e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
								)
	);

/** All text in <t> elements, joined (rich text splits a string across runs). */
const texts = (xml: string) =>
	[...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => unescape(m[1]!)).join('');

/** "C" → 2, "AB" → 27. */
const columnIndex = (letters: string) =>
	[...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** A workbook's sheets by name, each as rows of cell text (empty cells are ""). */
export function readWorkbook(bytes: Uint8Array): Map<string, string[][]> {
	const files = readZip(bytes);
	const xml = (name: string) => {
		const f = files.get(name);
		if (!f) throw new ImportError(NOT_A_SPREADSHEET);
		const text = f.toString('utf8');
		if (text.includes('<!DOCTYPE') || text.includes('<!ENTITY'))
			throw new ImportError(NOT_A_SPREADSHEET);
		return text;
	};
	const workbook = xml('xl/workbook.xml');
	const rels = files.has('xl/_rels/workbook.xml.rels') ? xml('xl/_rels/workbook.xml.rels') : '';
	const targets = new Map(
		[...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
			/Id="([^"]+)"/.exec(m[0])?.[1] ?? '',
			/Target="([^"]+)"/.exec(m[0])?.[1] ?? ''
		])
	);
	const shared = files.has('xl/sharedStrings.xml')
		? [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]!))
		: [];

	const sheets = new Map<string, string[][]>();
	for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
		const name = unescape(/name="([^"]*)"/.exec(m[0])?.[1] ?? '');
		const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] ?? '';
		const target = targets.get(rid);
		if (!target) continue;
		const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
		const sheet = xml(path);
		const rows: string[][] = [];
		for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
			const cells: string[] = [];
			for (const c of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
				const attrs = c[1]!;
				const inner = c[2] ?? '';
				const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
				const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? 'n';
				const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
				const value =
					type === 'inlineStr'
						? texts(inner)
						: type === 's'
							? (shared[Number(v)] ?? '')
							: v === undefined
								? ''
								: unescape(v);
				const index = ref ? columnIndex(ref) : cells.length;
				while (cells.length < index) cells.push('');
				cells[index] = value;
			}
			rows.push(cells);
		}
		sheets.set(name, rows);
	}
	return sheets;
}
