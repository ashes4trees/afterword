import { describe, expect, it } from 'vitest';
import { describeWindow } from './ideas';

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
