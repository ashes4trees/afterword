import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { listBooks } from '$lib/server/services/books';
import { comingUpFor } from '$lib/server/services/reminders';
import { localToday } from '$lib/shared/bookList';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const author = requireAuthor(locals);
	const today = localToday();
	const [books, coming] = await Promise.all([
		listBooks(db, author),
		comingUpFor(db, author, today)
	]);
	return { hasBooks: books.length > 0, today, ...coming };
};
