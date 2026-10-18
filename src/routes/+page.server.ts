import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { listBooks } from '$lib/server/services/books';
import { comingUpFor, setHideOverdue } from '$lib/server/services/reminders';
import { localToday } from '$lib/shared/bookList';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const author = requireAuthor(locals);
	const today = localToday();
	const [books, coming] = await Promise.all([
		listBooks(db, author),
		comingUpFor(db, author, today)
	]);
	return { hasBooks: books.length > 0, today, ...coming };
};

export const actions: Actions = {
	overdue: async ({ request, locals }) => {
		const form = await request.formData();
		await setHideOverdue(db, requireAuthor(locals), form.get('hide') === 'true');
	}
};
