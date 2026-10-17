import type { Handle, ServerInit } from '@sveltejs/kit';
import { authenticate } from '$lib/server/auth';
import { PLAYBOOKS } from '$lib/server/content/playbooks';

// Loading the playbooks validates them; a bad pack stops the server here (#13).
export const init: ServerInit = () => {
	void PLAYBOOKS;
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.author = await authenticate(event);
	return resolve(event);
};
