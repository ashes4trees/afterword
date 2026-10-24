import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { campaignFormOptions, saveCampaign } from '$lib/server/services/ads';
import { CampaignInputSchema } from '$lib/shared/adForms';
import { campaignFormValues } from '$lib/shared/adFormValues';
import { localToday } from '$lib/shared/bookList';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const options = await campaignFormOptions(db, requireAuthor(locals));
	const book = url.searchParams.get('book');
	return {
		books: options.books,
		values: campaignFormValues(null, {
			titleId: options.books.some((b) => b.id === book) ? book! : (options.books[0]?.id ?? ''),
			status: 'enabled',
			channelSlug: 'kdp',
			marketplace: options.marketplace,
			campaignType: 'sponsored_products',
			targetingKind: 'auto',
			currency: options.currency,
			startedAt: localToday()
		})
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const form = await request.formData();
		const values = campaignFormValues(form, {});
		const parsed = CampaignInputSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { values, errors: z.flattenError(parsed.error).fieldErrors });
		}
		const id = await saveCampaign(db, requireAuthor(locals), null, parsed.data);
		if (!id)
			return fail(404, { values, errors: { titleId: ["That book doesn't exist any more."] } });
		redirect(303, resolve('/ads/[id]', { id }));
	}
};
