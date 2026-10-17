import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { deleteBook, listBooks } from '$lib/server/services/books';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	books: await listBooks(db, requireAuthor(locals))
});

export const actions: Actions = {
	// No redirect: with JavaScript the list refreshes in place and keeps its sort.
	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = z.uuid().safeParse(form.get('id'));
		if (!id.success) return fail(400, { deleteError: 'That book could not be found.' });
		const deleted = await deleteBook(db, requireAuthor(locals), id.data);
		if (!deleted) return fail(404, { deleteError: 'That book was already deleted.' });
		return { deleted: String(form.get('title') ?? '').slice(0, 200) };
	}
};
