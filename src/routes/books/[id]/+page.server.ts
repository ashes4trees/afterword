import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import {
	bookFormOptions,
	deleteBook,
	getBook,
	toFormValues,
	updateBook
} from '$lib/server/services/books';
import { TitleInputSchema, titleFormValues } from '$lib/shared/titles';
import type { Actions, PageServerLoad } from './$types';

function bookId(id: string) {
	if (!z.uuid().safeParse(id).success) error(404, 'Book not found');
	return id;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const author = requireAuthor(locals);
	const book = await getBook(db, author, bookId(params.id));
	if (!book) error(404, 'Book not found');
	return {
		title: book.workingTitle,
		values: toFormValues(book),
		options: await bookFormOptions(db, author)
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const author = requireAuthor(locals);
		const values = titleFormValues(await request.formData());
		const parsed = TitleInputSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { values, errors: z.flattenError(parsed.error).fieldErrors });
		}
		if (!(await updateBook(db, author, bookId(params.id), parsed.data))) {
			error(404, 'Book not found');
		}
		redirect(303, resolve('/books'));
	},
	delete: async ({ locals, params }) => {
		await deleteBook(db, requireAuthor(locals), bookId(params.id));
		redirect(303, resolve('/books'));
	}
};
