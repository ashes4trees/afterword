// The one authentication seam (#4). Today it's a single-account bypass: every request
// is the author named by DEV_AUTHOR_EMAIL. Real auth replaces the body of
// authenticate() with a session lookup; hooks.server.ts and everything downstream stay
// as they are.
import { error, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/client';
import { findOrCreateAuthorByEmail, type SessionAuthor } from '$lib/server/repo/authors';

export type { SessionAuthor };

export async function authenticate(_event: RequestEvent): Promise<SessionAuthor | null> {
	const email = env.DEV_AUTHOR_EMAIL?.trim();
	if (!email) throw new Error('DEV_AUTHOR_EMAIL is not set; see .env.example');
	return findOrCreateAuthorByEmail(db, email, env.DEV_AUTHOR_NAME?.trim() || 'Owner');
}

/** For load functions and actions that need a signed-in author. */
export function requireAuthor(locals: App.Locals): SessionAuthor {
	if (!locals.author) error(401, 'Sign in required');
	return locals.author;
}
