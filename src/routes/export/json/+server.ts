import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { exportAccount } from '$lib/server/services/export';
import { localToday } from '$lib/shared/bookList';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const data = await exportAccount(db, requireAuthor(locals));
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="afterword-export-${localToday()}.json"`,
			'cache-control': 'no-store'
		}
	});
};
