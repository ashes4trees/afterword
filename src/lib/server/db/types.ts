import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

/** A database handle or an open transaction. Repo functions take one as their first argument. */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
