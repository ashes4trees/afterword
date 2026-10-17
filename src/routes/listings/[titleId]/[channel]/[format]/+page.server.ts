import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import {
	addMarketListing,
	deleteListing,
	listingEditor,
	saveListing
} from '$lib/server/services/listings';
import {
	BOOK_FORMATS,
	CHANNELS,
	CHANNEL_SLUGS,
	FORMAT_LABELS,
	sellsFormat
} from '$lib/shared/channels';
import {
	listingFormValues,
	parseListingForm,
	type ListingFormValues
} from '$lib/shared/listingForm';
import { fromMinor } from '$lib/shared/money';
import type { Actions, PageServerLoad } from './$types';

// One book in one format on one store (#12), the default listing or one marketplace
// (?market=GB). The listing matrix links here.

function target(params: { titleId: string; channel: string; format: string }, url: URL) {
	const titleId = z.uuid().safeParse(params.titleId);
	const channel = z.enum(CHANNEL_SLUGS).safeParse(params.channel);
	const format = z.enum(BOOK_FORMATS).safeParse(params.format);
	if (!titleId.success || !channel.success || !format.success) error(404, 'Listing not found');
	if (!sellsFormat(channel.data, format.data)) error(404, 'This store doesn’t sell that format');
	const market = url.searchParams.get('market');
	return {
		titleId: titleId.data,
		channel: channel.data,
		format: format.data,
		market: market && /^[A-Z]{2}$/.test(market) ? market : null
	};
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const t = target(params, url);
	const editor = await listingEditor(
		db,
		requireAuthor(locals),
		t.titleId,
		t.channel,
		t.format,
		t.market
	);
	if (!editor) error(404, 'Book not found');
	const l = editor.listing;
	const values: ListingFormValues = {
		status: l?.status ?? 'not_started',
		externalId: l?.externalId ?? '',
		price: l?.priceMinor != null && l.currency ? fromMinor(l.priceMinor, l.currency) : '',
		currency: l?.currency ?? editor.defaultCurrency,
		enrolled: l?.enrolledInSelect ? 'on' : '',
		exclusivityStart: l?.exclusivityStart ?? '',
		exclusivityEnd: l?.exclusivityEnd ?? '',
		wholesaleDiscountPct: l?.wholesaleDiscountPct?.toString() ?? '',
		returnable: l?.returnable === true ? 'yes' : l?.returnable === false ? 'no' : ''
	};
	return {
		...editor,
		values,
		market: t.market,
		channel: CHANNELS.find((c) => c.slug === t.channel)!,
		format: { slug: t.format, label: FORMAT_LABELS[t.format] }
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params, url }) => {
		const t = target(params, url);
		const values = listingFormValues(await request.formData());
		const editor = await listingEditor(
			db,
			requireAuthor(locals),
			t.titleId,
			t.channel,
			t.format,
			t.market
		);
		if (!editor) error(404, 'Book not found');
		const parsed = parseListingForm(values, {
			exclusive: !!editor.program,
			printTerms: editor.printTerms
		});
		if (!parsed.success) return fail(400, { values, errors: parsed.errors });
		await saveListing(
			db,
			requireAuthor(locals),
			t.titleId,
			t.channel,
			t.format,
			t.market,
			parsed.data
		);
		return { saved: true };
	},
	addMarket: async ({ request, locals, params, url }) => {
		const t = target(params, url);
		const code = String((await request.formData()).get('market') ?? '')
			.trim()
			.toUpperCase();
		if (!/^[A-Z]{2}$/.test(code))
			return fail(400, { marketError: 'Use a two-letter country code, like GB' });
		await addMarketListing(db, requireAuthor(locals), t.titleId, t.channel, t.format, code);
		redirect(
			303,
			`${resolve('/listings/[titleId]/[channel]/[format]', { titleId: t.titleId, channel: t.channel, format: t.format })}?market=${code}`
		);
	},
	remove: async ({ locals, params, url }) => {
		const t = target(params, url);
		await deleteListing(db, requireAuthor(locals), t.titleId, t.channel, t.format, t.market);
		redirect(303, resolve('/listings'));
	}
};
