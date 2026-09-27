import { sql } from 'drizzle-orm';
import type { Executor } from './types';

/**
 * The only way to run queries against tenant tables. Opens a transaction, tells
 * Postgres which author it's for, and runs `fn` inside it. Row-level security
 * (tenantPolicy in schema.ts) then only returns and accepts that author's rows, even
 * if a query forgets its author_id filter.
 *
 * The setting is transaction-local, so it can't leak to the next request that reuses
 * the pooled connection.
 */
export async function withAuthor<T>(
	db: Executor,
	authorId: string,
	fn: (tx: Executor) => Promise<T>
): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select set_config('app.author_id', ${authorId}, true)`);
		return fn(tx);
	});
}
