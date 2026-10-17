// Reminder kinds (#46). Each source of dated items registers a kind here; the engine
// and the settings page work from this list, so a new source needs no engine change.

export const REMINDER_KINDS = ['key_date', 'commitment'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** How each kind is described to authors, in plain words. */
export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
	key_date: 'Key dates in your launch timelines',
	commitment: 'Exclusivity terms ending, like KDP Select'
};

/** Lead times offered in settings, in days before the date. */
export const LEAD_DAY_CHOICES = [1, 3, 7, 14, 30] as const;
