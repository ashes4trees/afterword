import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import {
	campaignDetail,
	campaignFormOptions,
	deleteCampaign,
	deleteResults,
	recordResults,
	reviewNow,
	saveCampaign
} from '$lib/server/services/ads';
import { CampaignInputSchema, resultsSchema } from '$lib/shared/adForms';
import { campaignFormValues, storedCampaignValues } from '$lib/shared/adFormValues';
import { localToday } from '$lib/shared/bookList';
import type { Actions, PageServerLoad } from './$types';

const campaignId = (id: string) => {
	if (!z.uuid().safeParse(id).success) error(404, 'Campaign not found');
	return id;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	const author = requireAuthor(locals);
	const [detail, options] = await Promise.all([
		campaignDetail(db, author, campaignId(params.id)),
		campaignFormOptions(db, author)
	]);
	if (!detail) error(404, 'Campaign not found');
	return {
		...detail,
		books: options.books,
		values: storedCampaignValues(detail.campaign),
		today: localToday()
	};
};

const PERIOD = z.object({ periodStart: z.iso.date(), periodEnd: z.iso.date() });

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const values = campaignFormValues(await request.formData(), {});
		const parsed = CampaignInputSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { values, errors: z.flattenError(parsed.error).fieldErrors });
		}
		if (!(await saveCampaign(db, requireAuthor(locals), campaignId(params.id), parsed.data))) {
			return fail(404, { values, errors: { titleId: ["That book doesn't exist any more."] } });
		}
		return { saved: true };
	},
	results: async ({ request, locals, params }) => {
		const author = requireAuthor(locals);
		const id = campaignId(params.id);
		const detail = await campaignDetail(db, author, id);
		if (!detail) error(404, 'Campaign not found');
		const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
		const parsed = resultsSchema(detail.campaign.currency).safeParse({
			impressions: '',
			clicks: '',
			...raw
		});
		if (!parsed.success) {
			return fail(400, { resultsValues: raw, resultsError: parsed.error.issues[0]!.message });
		}
		await recordResults(db, author, id, parsed.data);
		return { recorded: true };
	},
	deleteResults: async ({ request, locals, params }) => {
		const p = PERIOD.safeParse(Object.fromEntries(await request.formData()));
		if (!p.success) return fail(400, { resultsError: 'That period could not be removed.' });
		await deleteResults(
			db,
			requireAuthor(locals),
			campaignId(params.id),
			p.data.periodStart,
			p.data.periodEnd
		);
	},
	review: async ({ locals, params }) => {
		const review = await reviewNow(db, requireAuthor(locals), campaignId(params.id), localToday());
		if (!review) error(404, 'Campaign not found');
		return { reviewed: true };
	},
	delete: async ({ locals, params }) => {
		await deleteCampaign(db, requireAuthor(locals), campaignId(params.id));
		redirect(303, resolve('/ads'));
	}
};
