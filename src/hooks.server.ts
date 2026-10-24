import type { Handle, ServerInit } from '@sveltejs/kit';
import { authenticate } from '$lib/server/auth';
import { PLAYBOOKS } from '$lib/server/content/playbooks';
import { RULES } from '$lib/server/content/rulePacks';

// Loading the playbooks and rules validates them; a bad file stops the server here (#13, #18).
export const init: ServerInit = () => {
	void PLAYBOOKS;
	void RULES;
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.author = await authenticate(event);
	return resolve(event);
};
