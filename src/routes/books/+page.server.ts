import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { listBooks } from '$lib/server/services/books';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	books: await listBooks(db, requireAuthor(locals))
});
