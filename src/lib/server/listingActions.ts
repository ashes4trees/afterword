import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { removeListing, setListingStatus } from '$lib/server/services/listings';
import {
	BOOK_FORMATS,
	CHANNELS,
	CHANNEL_SLUGS,
	FORMAT_LABELS,
	sellsFormat
} from '$lib/shared/channels';
import { LISTING_STATUSES } from '$lib/shared/listings';

// Form actions shared by the matrix and the listing page, so routes stay thin.

const Target = z.object({
	titleId: z.uuid(),
	channel: z.enum(CHANNEL_SLUGS),
	format: z.enum(BOOK_FORMATS)
});

async function parse(request: Request) {
	return Object.fromEntries(await request.formData());
}

export async function setStatusAction({
	request,
	locals
}: {
	request: Request;
	locals: App.Locals;
}) {
	const parsed = Target.extend({ status: z.enum(LISTING_STATUSES) }).safeParse(
		await parse(request)
	);
	if (!parsed.success) return fail(400, { listingError: 'That change could not be saved.' });
	const { titleId, channel, format, status } = parsed.data;
	if (!sellsFormat(channel, format)) {
		const store = CHANNELS.find((c) => c.slug === channel)!.displayName;
		return fail(400, {
			listingError: `${store} doesn't sell ${FORMAT_LABELS[format].toLowerCase()}s.`
		});
	}
	if (!(await setListingStatus(db, requireAuthor(locals), titleId, channel, format, status))) {
		return fail(404, { listingError: 'That book no longer exists.' });
	}
	return { changed: { titleId, channel, format } };
}

export async function removeAction({ request, locals }: { request: Request; locals: App.Locals }) {
	const parsed = Target.safeParse(await parse(request));
	if (!parsed.success) return fail(400, { listingError: 'That listing could not be removed.' });
	const { titleId, channel, format } = parsed.data;
	await removeListing(db, requireAuthor(locals), titleId, channel, format);
	return { changed: { titleId, channel, format } };
}
