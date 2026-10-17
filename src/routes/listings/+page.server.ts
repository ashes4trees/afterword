import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { removeAction, setStatusAction } from '$lib/server/listingActions';
import { listingMatrix } from '$lib/server/services/listings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => listingMatrix(db, requireAuthor(locals));

// No redirect: the matrix refreshes in place and keeps its filters.
export const actions: Actions = { setStatus: setStatusAction, remove: removeAction };
