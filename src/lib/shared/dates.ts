/** A YYYY-MM-DD calendar date for display. Formatted in UTC so it never shifts a day. */
export const formatDate = (d: string, style: 'medium' | 'short' = 'medium') =>
	new Date(`${d}T00:00:00Z`).toLocaleDateString(
		'en',
		style === 'short'
			? { timeZone: 'UTC', month: 'short', day: 'numeric' }
			: { timeZone: 'UTC', dateStyle: 'medium' }
	);

const DAY = 86_400_000;
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Whole days from `today` to `date` (negative when past), both YYYY-MM-DD. */
export const daysBetween = (today: string, date: string) =>
	Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

/** "today", "in 3 days", "in 5 weeks", "2 days ago": how far a due date is from today. */
export function dueDistance(date: string, today: string): string {
	const days = daysBetween(today, date);
	if (Math.abs(days) <= 13) return relative.format(days, 'day');
	if (Math.abs(days) <= 60) return relative.format(Math.round(days / 7), 'week');
	return relative.format(Math.round(days / 30.44), 'month');
}
