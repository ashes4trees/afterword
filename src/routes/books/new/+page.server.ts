import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { bookFormOptions, createBook, listBooks } from '$lib/server/services/books';
import { nextSeriesPosition } from '$lib/shared/bookList';
import { EMPTY_TITLE_FORM, TitleInputSchema, titleFormValues } from '$lib/shared/titles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const author = requireAuthor(locals);
	// "Add book to this series" links here with ?series=, prefilling the next position.
	const series = url.searchParams.get('series')?.trim().slice(0, 200);
	const initial = series
		? {
				...EMPTY_TITLE_FORM,
				seriesTitle: series,
				seriesPosition: String(nextSeriesPosition(await listBooks(db, author), series))
			}
		: EMPTY_TITLE_FORM;
	return { options: await bookFormOptions(db, author), initial };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const author = requireAuthor(locals);
		const values = titleFormValues(await request.formData());
		const parsed = TitleInputSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { values, errors: z.flattenError(parsed.error).fieldErrors });
		}
		await createBook(db, author, parsed.data);
		redirect(303, resolve('/books'));
	}
};
