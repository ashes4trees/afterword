import { describe, expect, it } from 'vitest';
import { parseListingForm, type ListingFormValues } from './listingForm';

const blank: ListingFormValues = {
	status: 'live',
	externalId: '',
	price: '',
	currency: 'USD',
	enrolled: '',
	exclusivityStart: '',
	exclusivityEnd: '',
	wholesaleDiscountPct: '',
	returnable: ''
};
const all = { exclusive: true, printTerms: true };
const ok = (v: Partial<ListingFormValues>, applies = all) => {
	const r = parseListingForm({ ...blank, ...v }, applies);
	if (!r.success) throw new Error(JSON.stringify(r.errors));
	return r.data;
};
const errs = (v: Partial<ListingFormValues>, applies = all) => {
	const r = parseListingForm({ ...blank, ...v }, applies);
	return r.success ? {} : r.errors;
};

describe('parseListingForm', () => {
	it('stores a price as minor units with its currency, or neither', () => {
		expect(ok({ price: '4.99' })).toMatchObject({ priceMinor: 499, currency: 'USD' });
		expect(ok({ price: '' })).toMatchObject({ priceMinor: null, currency: null });
		expect(errs({ price: '4.999' }).price).toBeDefined();
		expect(errs({ price: '5', currency: '' }).currency).toBeDefined();
	});

	it('needs both term dates when enrolled, in order', () => {
		expect(
			ok({ enrolled: 'on', exclusivityStart: '2026-11-01', exclusivityEnd: '2027-01-30' })
		).toMatchObject({ enrolledInSelect: true, exclusivityEnd: '2027-01-30' });
		expect(errs({ enrolled: 'on', exclusivityStart: '2026-11-01' }).exclusivityEnd).toBeDefined();
		expect(
			errs({ enrolled: 'on', exclusivityStart: '2026-11-01', exclusivityEnd: '2026-10-01' })
				.exclusivityEnd
		).toMatch(/before the start/);
	});

	it('clears exclusivity when not enrolled, or where the store has no program', () => {
		expect(ok({ exclusivityStart: '2026-11-01' })).toMatchObject({ exclusivityStart: null });
		expect(
			ok({ enrolled: 'on', exclusivityStart: 'nonsense' }, { exclusive: false, printTerms: false })
		).toMatchObject({ enrolledInSelect: false, exclusivityStart: null });
	});

	it('reads wholesale terms only for print on stores that use them', () => {
		expect(ok({ wholesaleDiscountPct: '55', returnable: 'no' })).toMatchObject({
			wholesaleDiscountPct: 55,
			returnable: false
		});
		expect(errs({ wholesaleDiscountPct: '120' }).wholesaleDiscountPct).toBeDefined();
		expect(
			ok({ wholesaleDiscountPct: '120' }, { exclusive: false, printTerms: false })
		).toMatchObject({ wholesaleDiscountPct: null, returnable: null });
	});

	it('rejects an unknown status', () => {
		expect(errs({ status: 'drafting' }).status).toBeDefined();
	});
});
