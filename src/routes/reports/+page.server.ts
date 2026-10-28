import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { deleteImport, importReport, listImports } from '$lib/server/services/imports';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	imports: await listImports(db, requireAuthor(locals))
});

export const actions: Actions = {
	/** A report upload (C3: files only). Parsed in memory; the file itself is never stored. */
	upload: async ({ request, locals }) => {
		const file = (await request.formData()).get('report');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { uploadError: 'Choose the report file to upload.' });
		}
		const summary = await importReport(
			db,
			requireAuthor(locals),
			file.name,
			new Uint8Array(await file.arrayBuffer())
		);
		if (!summary.ok) return fail(400, { uploadError: summary.error });
		return { summary };
	},
	delete: async ({ request, locals }) => {
		const id = z.uuid().safeParse((await request.formData()).get('id'));
		if (id.success) await deleteImport(db, requireAuthor(locals), id.data);
	}
};
