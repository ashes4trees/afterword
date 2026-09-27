import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	author: locals.author && { displayName: locals.author.displayName }
});
