import type { ReminderKind } from '$lib/shared/reminders';

// Reminders (#46): one engine for every dated item in the app. Pure: sources hand it
// items, the author's lead times, and today's date. The Coming up list and email
// delivery (#27) both use it.

/** Anything with a date worth a reminder. Sources map their rows to this. */
export type DatedItem = {
	kind: ReminderKind;
	/** What it's about, such as a book's title. */
	subject: string;
	/** YYYY-MM-DD. */
	date: string;
	label: string;
	/** Stable id, so a delivered reminder isn't sent twice (#27). */
	key: string;
};

export type ReminderPrefs = {
	lead_days: number[];
	by_kind: Partial<Record<ReminderKind, number[]>>;
};

export type Reminder = DatedItem & {
	/** Days from today to the date; negative when it has passed. */
	daysUntil: number;
	/** The lead time this reminder answers to, or null when the date has passed. */
	lead: number | null;
	overdue: boolean;
};

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export const leadsFor = (kind: ReminderKind, prefs: ReminderPrefs) =>
	prefs.by_kind[kind] ?? prefs.lead_days;

/**
 * The reminder an item calls for today, if any. A lead time's window opens that many
 * days before the date; the tightest open window wins. So an item added two days out,
 * with leads of 7 and 3, gets one "in 2 days" reminder, not a stale 7-day one as well.
 */
export function reminderFor(item: DatedItem, prefs: ReminderPrefs, today: string): Reminder | null {
	const daysUntil = daysBetween(today, item.date);
	if (daysUntil < 0) return { ...item, daysUntil, lead: null, overdue: true };
	const open = leadsFor(item.kind, prefs).filter((lead) => daysUntil <= lead);
	if (open.length === 0) return null;
	return { ...item, daysUntil, lead: Math.min(...open), overdue: false };
}

/** Reminders due today, for delivery (#27): open windows only, never overdue items. */
export function remindersDue(items: DatedItem[], prefs: ReminderPrefs, today: string): Reminder[] {
	return items
		.map((i) => reminderFor(i, prefs, today))
		.filter((r): r is Reminder => r !== null && !r.overdue)
		.sort(bySoonest);
}

/**
 * The Coming up list: everything in a reminder window, plus anything overdue. Overdue
 * items show even with reminders off, since they're still on the author's timeline.
 */
export function comingUp(items: DatedItem[], prefs: ReminderPrefs, today: string): Reminder[] {
	return items
		.map((i) => reminderFor(i, prefs, today))
		.filter((r): r is Reminder => r !== null)
		.sort(bySoonest);
}

/**
 * How many days ahead Coming up looks: the longest lead time of any kind. Null when
 * reminders are off. Zero (reminders on the day only) is on.
 */
export function reminderWindow(prefs: ReminderPrefs): number | null {
	const leads = [...prefs.lead_days, ...Object.values(prefs.by_kind).flat()];
	return leads.length ? Math.max(...leads) : null;
}

const bySoonest = (a: Reminder, b: Reminder) =>
	a.daysUntil - b.daysUntil || a.subject.localeCompare(b.subject) || a.label.localeCompare(b.label);
