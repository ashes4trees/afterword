import type { Handle } from '@sveltejs/kit';
import { authenticate } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.author = await authenticate(event);
	return resolve(event);
};
