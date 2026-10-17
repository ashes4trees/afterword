import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { removeListing, setListingStatus } from '$lib/server/services/listings';
import { CHANNEL_SLUGS } from '$lib/shared/channels';
import { LISTING_STATUSES } from '$lib/shared/listings';

// Form actions shared by the matrix and the listing page, so routes stay thin.

const Target = z.object({ titleId: z.uuid(), channel: z.enum(CHANNEL_SLUGS) });

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
	const { titleId, channel, status } = parsed.data;
	if (!(await setListingStatus(db, requireAuthor(locals), titleId, channel, status))) {
		return fail(404, { listingError: 'That book no longer exists.' });
	}
	return { changed: { titleId, channel } };
}

export async function removeAction({ request, locals }: { request: Request; locals: App.Locals }) {
	const parsed = Target.safeParse(await parse(request));
	if (!parsed.success) return fail(400, { listingError: 'That listing could not be removed.' });
	const { titleId, channel } = parsed.data;
	await removeListing(db, requireAuthor(locals), titleId, channel);
	return { changed: { titleId, channel } };
}
