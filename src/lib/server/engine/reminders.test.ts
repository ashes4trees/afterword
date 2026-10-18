import { describe, expect, it } from 'vitest';
import { comingUp, reminderFor, reminderWindow, remindersDue, type DatedItem } from './reminders';

const prefs = { lead_days: [7, 3], by_kind: {} };
const TODAY = '2026-10-17';
const item = (date: string, label = 'Cover reveal'): DatedItem => ({
	kind: 'key_date',
	subject: 'The Glass Archive',
	date,
	label,
	key: `${label}:${date}`
});

describe('reminderFor', () => {
	it.each([
		['outside every window', '2026-11-01', null],
		['the 7-day window', '2026-10-24', 7],
		['inside both windows: the tighter one wins', '2026-10-19', 3],
		['the day itself', '2026-10-17', 3]
	])('%s', (_label, date, lead) => {
		expect(reminderFor(item(date), prefs, TODAY)?.lead ?? null).toBe(lead);
	});

	it('gives one reminder, not stale ones, for an item added after its lead times passed', () => {
		const r = reminderFor(item('2026-10-19'), prefs, TODAY)!;
		expect(r).toMatchObject({ daysUntil: 2, lead: 3, overdue: false });
	});

	it('marks a passed date overdue', () => {
		expect(reminderFor(item('2026-10-10'), prefs, TODAY)).toMatchObject({
			daysUntil: -7,
			lead: null,
			overdue: true
		});
	});

	it('uses per-kind lead times when set', () => {
		const custom = { lead_days: [7, 3], by_kind: { key_date: [30] } };
		expect(reminderFor(item('2026-11-10'), custom, TODAY)?.lead).toBe(30);
		expect(reminderFor(item('2026-11-10'), prefs, TODAY)).toBeNull();
	});

	it('supports a reminder on the day only', () => {
		const dayOf = { lead_days: [0], by_kind: {} };
		expect(reminderFor(item('2026-10-18'), dayOf, TODAY)).toBeNull();
		expect(reminderFor(item('2026-10-17'), dayOf, TODAY)?.lead).toBe(0);
	});
});

describe('lists', () => {
	const items = [
		item('2026-10-24', 'Send ARCs'),
		item('2026-10-12', 'Recruit ARC readers'),
		item('2026-12-01', 'Launch day'),
		item('2026-10-18', 'Cover reveal')
	];

	it('Coming up: open windows and overdue items, soonest first', () => {
		expect(comingUp(items, prefs, TODAY).map((r) => r.label)).toEqual([
			'Recruit ARC readers',
			'Cover reveal',
			'Send ARCs'
		]);
	});

	it('due for delivery: open windows only, never overdue', () => {
		expect(remindersDue(items, prefs, TODAY).map((r) => r.label)).toEqual([
			'Cover reveal',
			'Send ARCs'
		]);
	});
});

describe('reminderWindow', () => {
	it.each([
		['the longest default lead', { lead_days: [7, 3], by_kind: {} }, 7],
		['a longer per-kind lead', { lead_days: [3], by_kind: { key_date: [30] } }, 30],
		['custom times with the defaults off', { lead_days: [], by_kind: { key_date: [14] } }, 14],
		['on the day only, which is on', { lead_days: [0], by_kind: {} }, 0],
		['nothing ticked: off', { lead_days: [], by_kind: {} }, null]
	])('%s', (_label, p, expected) => {
		expect(reminderWindow(p)).toBe(expected);
	});

	it('keeps overdue items in Coming up with reminders off', () => {
		const off = { lead_days: [], by_kind: {} };
		expect(comingUp([item('2026-10-10'), item('2026-10-18')], off, TODAY)).toMatchObject([
			{ date: '2026-10-10', overdue: true }
		]);
	});
});
