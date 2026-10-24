import { describe, expect, it } from 'vitest';
import {
	EMPTY_MY_IDEA,
	MyIdeaSchema,
	describeWindow,
	myIdeaFormValues,
	type MyIdeaFormValues
} from './ideas';

describe('describeWindow', () => {
	it.each([
		[null, 'Anytime'],
		[{ from_days: -56, to_days: -35 }, 'Best 8 to 5 weeks before release'],
		[{ from_days: -7, to_days: -1 }, 'Best 7 days to 1 day before release'],
		[{ from_days: -42, to_days: -7 }, 'Best 6 weeks to 1 week before release'],
		[{ from_days: -63, to_days: -57 }, 'Best 63 to 57 days before release'],
		[{ from_days: 14, to_days: 56 }, 'Best 2 to 8 weeks after release'],
		[{ from_days: 0, to_days: 7 }, 'From release day to 1 week after'],
		[{ from_days: -7, to_days: 7 }, 'From 1 week before to 1 week after release'],
		[{ from_days: -14, to_days: 0 }, 'In the 2 weeks before release']
	])('%j → %s', (w, text) => {
		expect(describeWindow(w)).toBe(text);
	});
});

describe('MyIdeaSchema', () => {
	const form = (o: Partial<MyIdeaFormValues> = {}) => ({
		...EMPTY_MY_IDEA,
		label: 'Live read',
		...o
	});

	it('turns weeks before and after release into a window, and blank into Anytime', () => {
		expect(MyIdeaSchema.parse(form({ fromWeeks: '4', toWeeks: '1' })).window).toEqual({
			from_days: -28,
			to_days: -7
		});
		expect(
			MyIdeaSchema.parse(form({ fromWeeks: '1', toWeeks: '2', toSide: 'after' })).window
		).toEqual({ from_days: -7, to_days: 14 });
		expect(MyIdeaSchema.parse(form()).window).toBeNull();
	});

	it('trims, keeps notes short, and reads the repeat checkbox', () => {
		expect(
			MyIdeaSchema.parse(form({ label: '  Live read ', note: ' ', repeatable: 'on' }))
		).toEqual({
			label: 'Live read',
			note: null,
			phase: 'prelaunch',
			window: null,
			repeatable: true,
			shared: false
		});
		expect(MyIdeaSchema.safeParse(form({ note: 'x'.repeat(281) })).success).toBe(false);
		expect(MyIdeaSchema.safeParse(form({ label: '' })).success).toBe(false);
	});

	it.each([
		[{ fromWeeks: '4' }, 'Fill in both ends, or neither.'],
		[{ fromWeeks: '1', toWeeks: '4' }, 'The end comes before the start.'],
		[{ fromWeeks: '2.5', toWeeks: '1' }, 'Use whole weeks, like 4.']
	])('explains a bad window: %j', (o, message) => {
		const r = MyIdeaSchema.safeParse(form(o));
		expect(r.error?.issues[0]?.message).toBe(message);
	});

	it('reads the share checkbox', () => {
		expect(MyIdeaSchema.parse(form({ share: 'on' })).shared).toBe(true);
		expect(MyIdeaSchema.parse(form()).shared).toBe(false);
	});

	it('round-trips through the edit form', () => {
		const idea = MyIdeaSchema.parse(
			form({ fromWeeks: '2', toWeeks: '3', toSide: 'after', share: 'on' })
		);
		expect(MyIdeaSchema.parse(myIdeaFormValues(idea))).toEqual(idea);
	});
});
