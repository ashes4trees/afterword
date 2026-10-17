import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { getBook } from '$lib/server/services/books';
import {
	addIdea,
	addOwnStep,
	bookTimeline,
	removeAddedStep,
	setIdeaHidden,
	setTaskDone,
	setTaskDue,
	setTaskSkipped
} from '$lib/server/services/tasks';
import { localToday } from '$lib/shared/bookList';
import type { Actions, PageServerLoad } from './$types';

const bookId = (id: string) => {
	if (!z.uuid().safeParse(id).success) error(404, 'Book not found');
	return id;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	const author = requireAuthor(locals);
	const book = await getBook(db, author, bookId(params.id));
	if (!book) error(404, 'Book not found');
	const today = localToday();
	return {
		book: { id: book.id, title: book.workingTitle, releaseDate: book.releaseDate },
		today,
		timeline: (await bookTimeline(db, author, book.id, today))!
	};
};

async function form(request: Request) {
	return Object.fromEntries(await request.formData());
}

const notFound = () => fail(404, { taskError: 'That step no longer exists. Refresh the page.' });
const invalid = (message = 'That change could not be saved.') => fail(400, { taskError: message });
const Idea = z.object({ pack: z.string().max(80), stepId: z.string().max(60) });

export const actions: Actions = {
	done: async ({ request, locals }) => {
		const f = z.object({ task: z.uuid(), done: z.enum(['0', '1']) }).safeParse(await form(request));
		if (!f.success) return invalid();
		if (!(await setTaskDone(db, requireAuthor(locals), f.data.task, f.data.done === '1'))) {
			return notFound();
		}
	},
	skip: async ({ request, locals }) => {
		const f = z.object({ task: z.uuid(), skip: z.enum(['0', '1']) }).safeParse(await form(request));
		if (!f.success) return invalid();
		if (!(await setTaskSkipped(db, requireAuthor(locals), f.data.task, f.data.skip === '1'))) {
			return notFound();
		}
	},
	due: async ({ request, locals, params }) => {
		const f = z
			.object({ task: z.uuid(), dueOn: z.union([z.iso.date(), z.literal('')]) })
			.safeParse(await form(request));
		if (!f.success) return invalid('Use a full date.');
		const ok = await setTaskDue(
			db,
			requireAuthor(locals),
			bookId(params.id),
			f.data.task,
			f.data.dueOn || null
		);
		if (!ok) return notFound();
	},
	remove: async ({ request, locals }) => {
		const f = z.object({ task: z.uuid() }).safeParse(await form(request));
		if (!f.success) return invalid();
		if (!(await removeAddedStep(db, requireAuthor(locals), f.data.task))) return notFound();
	},
	addIdea: async ({ request, locals, params }) => {
		const f = Idea.extend({
			start: z.iso.date(),
			times: z.coerce.number().int().min(1).max(8)
		}).safeParse(await form(request));
		if (!f.success) return invalid('Pick a date to add it on.');
		const { pack, stepId, start, times } = f.data;
		if (
			!(await addIdea(db, requireAuthor(locals), bookId(params.id), { pack, stepId }, start, times))
		) {
			return invalid('That idea could not be added.');
		}
		return { added: stepId };
	},
	addOwn: async ({ request, locals, params }) => {
		const f = z
			.object({
				label: z
					.string()
					.trim()
					.min(1, 'Give your step a name.')
					.max(120, 'Keep it under 120 characters.'),
				dueOn: z.union([z.iso.date(), z.literal('')])
			})
			.safeParse(await form(request));
		if (!f.success) return invalid(f.error.issues[0]?.message);
		if (
			!(await addOwnStep(
				db,
				requireAuthor(locals),
				bookId(params.id),
				f.data.label,
				f.data.dueOn || null
			))
		) {
			return notFound();
		}
		return { addedOwn: true };
	},
	hideIdea: async ({ request, locals, params }) => {
		const f = Idea.extend({ hide: z.enum(['0', '1']) }).safeParse(await form(request));
		if (!f.success) return invalid();
		const { pack, stepId, hide } = f.data;
		await setIdeaHidden(
			db,
			requireAuthor(locals),
			bookId(params.id),
			{ pack, stepId },
			hide === '1'
		);
	}
};
