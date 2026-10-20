import type { Executor } from '$lib/server/db/types';
import { deleteAuthor, type SessionAuthor } from '$lib/server/repo/authors';
import { confirmsEmail } from '$lib/shared/account';

// Account deletion (#40). Every author_id cascades from authors, so one delete removes
// everything, including decisions despite their append-only rule.

/** Deletes the signed-in author's account if `typedEmail` matches theirs. */
export async function deleteAccount(
	db: Executor,
	author: SessionAuthor,
	typedEmail: string
): Promise<'deleted' | 'mismatch'> {
	if (!confirmsEmail(typedEmail, author.email)) return 'mismatch';
	await deleteAuthor(db, author.id);
	return 'deleted';
}
