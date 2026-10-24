import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { chooseOption, selectVsWide } from '$lib/server/services/exclusivity';
import { getAuthorCurrency } from '$lib/server/services/books';
import { localToday } from '$lib/shared/bookList';
import { parseEdits, type EditParam } from '$lib/shared/exclusivityForm';
import type { Actions, PageServerLoad } from './$types';

const bookId = (id: string) => {
	if (!z.uuid().safeParse(id).success) error(404, 'Book not found');
	return id;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const author = requireAuthor(locals);
	const currency = await getAuthorCurrency(db, author);
	const { edits, values, problems } = parseEdits((n) => url.searchParams.get(n), currency);
	const result = await selectVsWide(db, author, bookId(params.id), localToday(), edits);
	if (!result) error(404, 'Book not found');
	return { ...result, values, problems };
};

export const actions: Actions = {
	choose: async ({ request, locals, params }) => {
		const author = requireAuthor(locals);
		const form = await request.formData();
		const option = z.enum(['select', 'wide', 'wide_direct']).safeParse(form.get('option'));
		if (!option.success) return fail(400, { chooseError: 'Pick an option.' });
		const rationale =
			String(form.get('rationale') ?? '')
				.trim()
				.slice(0, 500) || null;
		const currency = await getAuthorCurrency(db, author);
		const { edits } = parseEdits(
			(n: EditParam) => (form.get(n) as string | null) ?? null,
			currency
		);
		if (
			!(await chooseOption(
				db,
				author,
				bookId(params.id),
				option.data,
				rationale,
				localToday(),
				edits
			))
		) {
			error(404, 'Book not found');
		}
		return { chosen: option.data };
	}
};
