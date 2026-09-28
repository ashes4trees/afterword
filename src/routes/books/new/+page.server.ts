import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { bookFormOptions, createBook } from '$lib/server/services/books';
import { TitleInputSchema, titleFormValues } from '$lib/shared/titles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	options: await bookFormOptions(db, requireAuthor(locals))
});

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
