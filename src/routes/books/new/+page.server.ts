import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import {
	bookFormOptions,
	createBook,
	listBooks,
	newBookStoreOptions,
	setDefaultStores
} from '$lib/server/services/books';
import { CHANNEL_SLUGS } from '$lib/shared/channels';
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
	return {
		options: await bookFormOptions(db, author),
		stores: await newBookStoreOptions(db, author),
		initial
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const author = requireAuthor(locals);
		const data = await request.formData();
		const values = titleFormValues(data);
		const stores = z.array(z.enum(CHANNEL_SLUGS)).catch([]).parse(data.getAll('stores'));
		const parsed = TitleInputSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { values, stores, errors: z.flattenError(parsed.error).fieldErrors });
		}
		await createBook(db, author, parsed.data, stores);
		if (data.get('saveDefaultStores') === 'on') await setDefaultStores(db, author, stores);
		redirect(303, resolve('/books'));
	}
};
