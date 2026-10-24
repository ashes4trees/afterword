import { z } from 'zod';
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, TARGETING_KINDS } from './campaigns';
import { CHANNEL_SLUGS } from './channels';
import { toMinor } from './money';

// Forms on the Ads pages (#122). Money arrives as text ("12.50") and leaves as minor
// units in the campaign's currency, never converted.

const date = z.iso.date('Use a full date.');
const money = (label: string) => z.string().trim().min(1, `Enter the ${label}.`);

export const CampaignInputSchema = z
	.object({
		titleId: z.uuid('Pick a book.'),
		channelSlug: z.enum(CHANNEL_SLUGS),
		marketplace: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z]{2}$/, 'Use a two-letter country code, like US.'),
		name: z
			.string()
			.trim()
			.min(1, 'Give the campaign a name.')
			.max(200, 'Keep it under 200 characters.'),
		campaignType: z.enum(CAMPAIGN_TYPES),
		targetingKind: z.enum(TARGETING_KINDS),
		status: z.enum(CAMPAIGN_STATUSES),
		budget: z.string().trim(),
		currency: z.string().regex(/^[A-Z]{3}$/, 'Pick a currency.'),
		startedAt: date,
		endedAt: z.union([date, z.literal('')])
	})
	.transform((v, ctx) => {
		const dailyBudgetMinor = v.budget ? toMinor(v.budget, v.currency) : null;
		if (v.budget && (dailyBudgetMinor === null || dailyBudgetMinor <= 0)) {
			ctx.addIssue({ code: 'custom', path: ['budget'], message: 'Use an amount like 5.00.' });
			return z.NEVER;
		}
		if (v.endedAt && v.endedAt < v.startedAt) {
			ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'It ends before it starts.' });
			return z.NEVER;
		}
		const { budget: _budget, ...rest } = v;
		return { ...rest, dailyBudgetMinor, endedAt: v.endedAt || null };
	});
export type CampaignInput = z.output<typeof CampaignInputSchema>;

/** One period of results, in the campaign's currency. */
export const resultsSchema = (currency: string) =>
	z
		.object({
			periodStart: date,
			periodEnd: date,
			spend: money('amount spent'),
			sales: money('sales'),
			impressions: z.union([z.literal(''), z.string().regex(/^\d+$/, 'Use a whole number.')]),
			clicks: z.union([z.literal(''), z.string().regex(/^\d+$/, 'Use a whole number.')])
		})
		.transform((v, ctx) => {
			const spend = toMinor(v.spend, currency);
			const sales = toMinor(v.sales, currency);
			if (spend === null)
				ctx.addIssue({ code: 'custom', path: ['spend'], message: 'Use an amount like 12.50.' });
			if (sales === null)
				ctx.addIssue({ code: 'custom', path: ['sales'], message: 'Use an amount like 30.00.' });
			if (v.periodEnd < v.periodStart) {
				ctx.addIssue({
					code: 'custom',
					path: ['periodEnd'],
					message: 'The period ends before it starts.'
				});
			}
			if (spend === null || sales === null || v.periodEnd < v.periodStart) return z.NEVER;
			return {
				periodStart: v.periodStart,
				periodEnd: v.periodEnd,
				spendMinor: spend,
				salesMinor: sales,
				impressions: v.impressions ? Number(v.impressions) : null,
				clicks: v.clicks ? Number(v.clicks) : null
			};
		});
export type ResultsInput = z.output<ReturnType<typeof resultsSchema>>;

/**
 * Settings → Ads (#126). Each field is optional: blank clears the stored setting so the
 * rule's own default applies. Target ACOS is a percentage and may exceed 100.
 */
export const adSettingsSchema = (currency: string) =>
	z
		.object({
			targetAcos: z.string().trim(),
			evalDays: z.string().trim(),
			evalSpend: z.string().trim()
		})
		.transform((v, ctx) => {
			let ok = true;
			const issue = (path: string, message: string) => {
				ok = false;
				ctx.addIssue({ code: 'custom', path: [path], message });
			};
			const pct = v.targetAcos ? Number(v.targetAcos.replace(/%$/, '')) : null;
			if (pct !== null && !(Number.isFinite(pct) && pct > 0 && pct <= 500)) {
				issue('targetAcos', 'Use a percentage like 70.');
			}
			const days = v.evalDays ? Number(v.evalDays) : null;
			if (days !== null && !(Number.isInteger(days) && days >= 1 && days <= 365)) {
				issue('evalDays', 'Use whole days, 1 to 365.');
			}
			const spend = v.evalSpend ? toMinor(v.evalSpend, currency) : null;
			if (v.evalSpend && spend === null) {
				issue('evalSpend', 'Use an amount like 50.00.');
			}
			if (!ok) return z.NEVER;
			return {
				target_acos: pct === null ? null : Math.round(pct * 10) / 1000,
				min_ad_eval_days: days,
				min_ad_eval_spend_minor: spend
			};
		});
