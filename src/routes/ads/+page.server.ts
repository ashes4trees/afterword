import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { adsOverview } from '$lib/server/services/ads';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	campaigns: await adsOverview(db, requireAuthor(locals))
});
