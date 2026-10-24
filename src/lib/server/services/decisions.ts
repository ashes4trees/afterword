import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import type { SessionAuthor } from '$lib/server/repo/authors';
import * as decisionsRepo from '$lib/server/repo/decisions';
import * as works from '$lib/server/repo/works';
import type { DecisionInput } from '$lib/shared/decisions';

// The decision log (#26): every call the author made, append-only.

/** The log for the whole account, or for one book. */
export function decisionLog(db: Executor, author: SessionAuthor, titleId?: string) {
	return withAuthor(db, author.id, (tx) => decisionsRepo.listDecisions(tx, author.id, titleId));
}

/**
 * Logs a decision about a book, or about every book when `titleId` is null. It replaces
 * (supersedes, never edits) the current decision of the same kind about the same subject.
 * False if the book doesn't exist.
 */
export function logDecision(
	db: Executor,
	author: SessionAuthor,
	titleId: string | null,
	input: DecisionInput
) {
	return withAuthor(db, author.id, async (tx) => {
		if (titleId && !(await works.getTitle(tx, author.id, titleId))) return false;
		await decisionsRepo.recordDecision(tx, author.id, {
			subjectType: titleId ? 'title' : 'author',
			subjectId: titleId ?? author.id,
			kind: input.kind,
			choice: input.choice,
			rationale: input.rationale,
			commitsUntil: input.commitsUntil,
			source: 'author'
		});
		return true;
	});
}
