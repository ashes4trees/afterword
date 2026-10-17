import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { removeAction, setStatusAction } from '$lib/server/listingActions';
import { getListing } from '$lib/server/services/listings';
import { CHANNELS, CHANNEL_SLUGS } from '$lib/shared/channels';
import type { Actions, PageServerLoad } from './$types';

// One book on one channel. The matrix's fallback without JavaScript, and where the
// listing editor (#12) will grow.

export const load: PageServerLoad = async ({ locals, params }) => {
	const titleId = z.uuid().safeParse(params.titleId);
	const channel = z.enum(CHANNEL_SLUGS).safeParse(params.channel);
	if (!titleId.success || !channel.success) error(404, 'Listing not found');
	const { book, listing } = await getListing(db, requireAuthor(locals), titleId.data, channel.data);
	if (!book) error(404, 'Book not found');
	return {
		book: { id: book.id, workingTitle: book.workingTitle },
		channel: CHANNELS.find((c) => c.slug === channel.data)!,
		listing: listing ?? null
	};
};

// On success, go back to the matrix; on failure, stay and show the message.
export const actions: Actions = {
	setStatus: async (event) => {
		const result = await setStatusAction(event);
		if (!('changed' in result)) return result;
		redirect(303, resolve('/listings'));
	},
	remove: async (event) => {
		const result = await removeAction(event);
		if (!('changed' in result)) return result;
		redirect(303, resolve('/listings'));
	}
};
