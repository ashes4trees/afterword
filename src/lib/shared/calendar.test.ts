import { describe, expect, it } from 'vitest';
import { calendarWeeks, guessDropDate, weekLabel, weekOf } from './calendar';

// Release on Thursday 2027-01-07.
const RELEASE = '2027-01-07';

describe('weeks from release', () => {
	it('numbers weeks from release day', () => {
		expect(weekOf(RELEASE, '2027-01-07')).toBe(0);
		expect(weekOf(RELEASE, '2027-01-13')).toBe(0);
		expect(weekOf(RELEASE, '2027-01-06')).toBe(-1);
		expect(weekOf(RELEASE, '2026-12-31')).toBe(-1);
		expect(weekOf(RELEASE, '2026-12-30')).toBe(-2);
		expect(weekOf(RELEASE, '2027-01-14')).toBe(1);
	});

	it.each([
		[-6, '6 weeks out'],
		[-1, '1 week out'],
		[0, 'Release week'],
		[1, '1 week after'],
		[3, '3 weeks after']
	])('labels week %i as %s', (w, label) => {
		expect(weekLabel(w)).toBe(label);
	});

	it('covers every date, today, and release week, with empty weeks either side', () => {
		const weeks = calendarWeeks(RELEASE, '2026-12-01', ['2026-11-20', '2027-01-07']);
		expect(weeks[0]).toMatchObject({ week: -9, start: '2026-11-05', end: '2026-11-11' });
		expect(weeks.at(-1)?.week).toBe(3);
		expect(weeks.filter((w) => w.isNow).map((w) => w.label)).toEqual(['6 weeks out']);
	});
});

describe('guessDropDate', () => {
	const today = '2026-11-01';

	it('puts an idea on the first day of its window inside the week', () => {
		// Window: 10 to 3 days before release, 2026-12-28 to 2027-01-04. Week -1 starts 12-31.
		const idea = { kind: 'idea' as const, window: { from_days: -10, to_days: -3 } };
		expect(guessDropDate(idea, -1, RELEASE, today)).toBe('2026-12-31');
		expect(guessDropDate(idea, -2, RELEASE, today)).toBe('2026-12-28');
	});

	it('falls back to the release weekday when the idea window misses the week', () => {
		const idea = { kind: 'idea' as const, window: { from_days: -10, to_days: -3 } };
		expect(guessDropDate(idea, -5, RELEASE, today)).toBe('2026-12-03');
		expect(guessDropDate({ kind: 'idea', window: null }, -5, RELEASE, today)).toBe('2026-12-03');
	});

	it('keeps a step on its weekday', () => {
		// 2026-12-05 is 33 days before release: 2 days into its week.
		expect(guessDropDate({ kind: 'step', dueOn: '2026-12-05' }, -2, RELEASE, today)).toBe(
			'2026-12-26'
		);
	});

	it('never lands before today in the current week', () => {
		const now = '2026-12-02'; // week -6 runs 2026-11-26 to 2026-12-02
		expect(guessDropDate({ kind: 'idea', window: null }, -6, RELEASE, now)).toBe('2026-12-02');
	});
});
