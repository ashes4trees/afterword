import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { getBook } from '$lib/server/services/books';
import { bookTimelines, setTaskDone, setTaskDue, setTaskSkipped } from '$lib/server/services/tasks';
import type { Actions, PageServerLoad } from './$types';

const bookId = (id: string) => {
	if (!z.uuid().safeParse(id).success) error(404, 'Book not found');
	return id;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	const author = requireAuthor(locals);
	const book = await getBook(db, author, bookId(params.id));
	if (!book) error(404, 'Book not found');
	return {
		book: { id: book.id, title: book.workingTitle, releaseDate: book.releaseDate },
		timelines: await bookTimelines(db, author, book.id)
	};
};

async function form(request: Request) {
	return Object.fromEntries(await request.formData());
}

const notFound = () => fail(404, { taskError: 'That step no longer exists. Refresh the page.' });

export const actions: Actions = {
	done: async ({ request, locals }) => {
		const f = z.object({ task: z.uuid(), done: z.enum(['0', '1']) }).safeParse(await form(request));
		if (!f.success) return fail(400, { taskError: 'That change could not be saved.' });
		if (!(await setTaskDone(db, requireAuthor(locals), f.data.task, f.data.done === '1')))
			return notFound();
	},
	skip: async ({ request, locals }) => {
		const f = z.object({ task: z.uuid(), skip: z.enum(['0', '1']) }).safeParse(await form(request));
		if (!f.success) return fail(400, { taskError: 'That change could not be saved.' });
		if (!(await setTaskSkipped(db, requireAuthor(locals), f.data.task, f.data.skip === '1'))) {
			return notFound();
		}
	},
	due: async ({ request, locals, params }) => {
		const f = z
			.object({ task: z.uuid(), dueOn: z.union([z.iso.date(), z.literal('')]) })
			.safeParse(await form(request));
		if (!f.success) return fail(400, { taskError: 'Use a full date.' });
		const ok = await setTaskDue(
			db,
			requireAuthor(locals),
			bookId(params.id),
			f.data.task,
			f.data.dueOn || null
		);
		if (!ok) return notFound();
	}
};
