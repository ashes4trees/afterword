/**
 * A link to `base` with the current query string changed: a string sets a param, null
 * removes it, and everything else is kept. Used so sort, grouping, and filters never
 * reset each other.
 */
export function withQuery(
	base: string,
	current: URLSearchParams,
	changes: Record<string, string | null>
): string {
	const params = new URLSearchParams(current);
	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === '') params.delete(key);
		else params.set(key, value);
	}
	const query = params.toString();
	return query ? `${base}?${query}` : base;
}
