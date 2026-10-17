import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFERENCES,
	PreferencesPatchSchema,
	PreferencesSchema,
	resolvePreferences
} from './preferences';

describe('DEFAULT_PREFERENCES', () => {
	it('satisfies its own schema', () => {
		expect(PreferencesSchema.parse(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
	});
});

describe('resolvePreferences', () => {
	it('returns every default when nothing is stored', () => {
		expect(resolvePreferences({})).toEqual({ preferences: DEFAULT_PREFERENCES, invalid: [] });
	});

	it.each([null, undefined, 'x', 42, []])('treats %j as empty', (stored) => {
		expect(resolvePreferences(stored).preferences).toEqual(DEFAULT_PREFERENCES);
	});

	it('overlays stored keys on defaults', () => {
		const { preferences } = resolvePreferences({ target_acos: 1.2, marketplaces: ['GB', 'US'] });
		expect(preferences).toEqual({
			...DEFAULT_PREFERENCES,
			target_acos: 1.2,
			marketplaces: ['GB', 'US']
		});
	});

	it('falls back per key when a stored value is invalid', () => {
		const { preferences, invalid } = resolvePreferences({ target_acos: -1, currency: 'EUR' });
		expect(invalid).toEqual(['target_acos']);
		expect(preferences.target_acos).toBe(DEFAULT_PREFERENCES.target_acos);
		expect(preferences.currency).toBe('EUR');
	});

	it('ignores unknown keys', () => {
		expect(resolvePreferences({ retired_setting: 1 })).toEqual({
			preferences: DEFAULT_PREFERENCES,
			invalid: []
		});
	});

	it('does not share array instances with the defaults', () => {
		const { preferences } = resolvePreferences({});
		preferences.marketplaces.push('CA');
		expect(DEFAULT_PREFERENCES.marketplaces).toEqual(['US']);
	});
});

describe('PreferencesPatchSchema', () => {
	it('accepts a partial patch, including null to reset', () => {
		expect(PreferencesPatchSchema.parse({ currency: 'GBP', target_acos: null })).toEqual({
			currency: 'GBP',
			target_acos: null
		});
	});

	it.each([
		['unknown key', { nope: 1 }],
		['acos of zero', { target_acos: 0 }],
		['fractional days', { min_ad_eval_days: 1.5 }],
		['negative spend', { min_ad_eval_spend_minor: -1 }],
		['fractional spend', { min_ad_eval_spend_minor: 12.5 }],
		['lowercase currency', { currency: 'usd' }],
		['empty marketplaces', { marketplaces: [] }],
		['duplicate marketplace', { marketplaces: ['US', 'US'] }],
		['unknown channel', { default_channels: ['smashwords'] }],
		['duplicate channel', { default_channels: ['kdp', 'kdp'] }],
		[
			'every store hidden',
			{
				hidden_channels: [
					'kdp',
					'kdp_print',
					'kobo',
					'd2d',
					'ingram',
					'apple',
					'google_play',
					'direct'
				]
			}
		],
		['ratio above 1', { cadence_ratio: 1.5 }]
	])('rejects %s', (_label, patch) => {
		expect(PreferencesPatchSchema.safeParse(patch).success).toBe(false);
	});
});
