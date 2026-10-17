/** A YYYY-MM-DD calendar date for display. Formatted in UTC so it never shifts a day. */
export const formatDate = (d: string, style: 'medium' | 'short' = 'medium') =>
	new Date(`${d}T00:00:00Z`).toLocaleDateString(
		'en',
		style === 'short'
			? { timeZone: 'UTC', month: 'short', day: 'numeric' }
			: { timeZone: 'UTC', dateStyle: 'medium' }
	);
