// Promo ideas (#84): phases and plain-language timing, shared by the server and the page.

export const IDEA_PHASES = ['writing', 'prelaunch', 'launch', 'after'] as const;
export type IdeaPhase = (typeof IDEA_PHASES)[number];

export const PHASE_LABELS: Record<IdeaPhase, string> = {
	writing: 'While you write',
	prelaunch: 'Before launch',
	launch: 'Launch week',
	after: 'After launch'
};

const amount = (n: number, unit: 'day' | 'week') => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** "Best 8 to 5 weeks before release", from a window in days relative to release. */
export function describeWindow(w: { from_days: number; to_days: number } | null): string {
	if (!w) return 'Anytime';
	const [from, to] = [w.from_days, w.to_days];
	const weeks = from % 7 === 0 && to % 7 === 0;
	const k = weeks ? 7 : 1;
	const unit = weeks ? 'week' : 'day';
	const n = (d: number) => Math.abs(d) / k;
	if (to < 0) {
		return from === to
			? `Best ${amount(n(from), unit)} before release`
			: n(to) === 1
				? `Best ${amount(n(from), unit)} to ${amount(1, unit)} before release`
				: `Best ${n(from)} to ${n(to)} ${unit}s before release`;
	}
	if (from > 0) return `Best ${n(from)} to ${n(to)} ${unit}s after release`;
	if (from === 0)
		return to === 0 ? 'On release day' : `From release day to ${amount(n(to), unit)} after`;
	if (to === 0) return `In the ${amount(n(from), unit)} before release`;
	return `From ${amount(n(from), unit)} before to ${amount(n(to), unit)} after release`;
}
