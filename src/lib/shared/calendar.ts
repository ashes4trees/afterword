import { daysBetween } from './dates';

// The timeline's calendar view (#112): weeks counted from release day, and where a
// dropped step or idea should land. Pure, so the page and the tests share it.

/** "Tue, Dec 1": a YYYY-MM-DD date with its weekday, in UTC so it never shifts a day. */
export const formatDay = (date: string) =>
	new Date(`${date}T00:00:00Z`).toLocaleDateString('en', {
		timeZone: 'UTC',
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});

/** A calendar date plus whole days, as YYYY-MM-DD. */
export function shiftDate(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/**
 * Week `n` relative to release: week 0 starts on release day, week -1 is the seven days
 * before it ("1 week out"), week 1 the seven after ("1 week after").
 */
export const weekOf = (releaseDate: string, date: string) =>
	Math.floor(daysBetween(releaseDate, date) / 7);

export const weekStart = (releaseDate: string, week: number) => shiftDate(releaseDate, week * 7);

export function weekLabel(week: number): string {
	if (week === 0) return 'Release week';
	const n = Math.abs(week);
	return week < 0
		? `${n} ${n === 1 ? 'week' : 'weeks'} out`
		: `${n} ${n === 1 ? 'week' : 'weeks'} after`;
}

export type CalendarWeek = {
	week: number;
	start: string;
	end: string;
	label: string;
	isNow: boolean;
};

/**
 * Every week from the earliest to the latest of the dates given, today, and release
 * week, plus `pad` empty weeks either side to drop into.
 */
export function calendarWeeks(
	releaseDate: string,
	today: string,
	dates: string[],
	pad = 2
): CalendarWeek[] {
	const weeks = [...dates, today, releaseDate].map((d) => weekOf(releaseDate, d));
	const first = Math.min(...weeks) - pad;
	const last = Math.max(...weeks, 1) + pad;
	const now = weekOf(releaseDate, today);
	return Array.from({ length: last - first + 1 }, (_, i) => {
		const week = first + i;
		const start = weekStart(releaseDate, week);
		return { week, start, end: shiftDate(start, 6), label: weekLabel(week), isNow: week === now };
	});
}

export type DropItem =
	| { kind: 'step'; dueOn: string | null }
	| { kind: 'idea'; window: { from_days: number; to_days: number } | null };

/**
 * The day a dropped item lands on in `week`. An idea takes the first day of its best
 * window inside that week. A step keeps its weekday. Otherwise it's the release day's
 * weekday, which is the week's first day. Never earlier than today when the week
 * includes today.
 */
export function guessDropDate(
	item: DropItem,
	week: number,
	releaseDate: string,
	today: string
): string {
	const start = weekStart(releaseDate, week);
	const end = shiftDate(start, 6);
	let day = start;
	if (item.kind === 'idea' && item.window) {
		const from = shiftDate(releaseDate, item.window.from_days);
		const to = shiftDate(releaseDate, item.window.to_days);
		if (from <= end && to >= start) day = from > start ? from : start;
	} else if (item.kind === 'step' && item.dueOn) {
		const offset = ((daysBetween(releaseDate, item.dueOn) % 7) + 7) % 7;
		day = shiftDate(start, offset);
	}
	return today >= start && today <= end && day < today ? today : day;
}
