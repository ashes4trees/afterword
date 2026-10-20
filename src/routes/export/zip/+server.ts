import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { exportAccountZip } from '$lib/server/services/export';
import { localToday } from '$lib/shared/bookList';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const zip = await exportAccountZip(db, requireAuthor(locals));
	return new Response(zip, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="afterword-export-${localToday()}.zip"`,
			'cache-control': 'no-store'
		}
	});
};
