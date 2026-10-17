import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { removeAction, setStatusAction } from '$lib/server/listingActions';
import { listingMatrix, setHiddenChannels } from '$lib/server/services/listings';
import { CHANNEL_SLUGS } from '$lib/shared/channels';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => listingMatrix(db, requireAuthor(locals));

// No redirects: the matrix refreshes in place and keeps its filters.
export const actions: Actions = {
	setStatus: setStatusAction,
	remove: removeAction,
	// The Stores menu submits the stores to show; everything else is hidden.
	stores: async ({ request, locals }) => {
		const shown = z
			.array(z.enum(CHANNEL_SLUGS))
			.safeParse((await request.formData()).getAll('show'));
		if (!shown.success) return fail(400, { storesError: 'That store list could not be saved.' });
		if (shown.data.length === 0) return fail(400, { storesError: 'Keep at least one store.' });
		const hidden = CHANNEL_SLUGS.filter((slug) => !shown.data.includes(slug));
		await setHiddenChannels(db, requireAuthor(locals), hidden);
		return { storesSaved: true };
	}
};
