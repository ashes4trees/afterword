import { z } from 'zod';
import { LISTING_STATUSES, type ListingStatus } from './listings';
import { toMinor } from './money';

// The listing editor's form (#12). Fields that don't apply to a listing (exclusivity for
// stores without a program, wholesale terms outside IngramSpark print) are cleared, not
// validated, so a hidden field can never block a save.

export type ListingFormValues = {
	status: string;
	externalId: string;
	price: string;
	currency: string;
	enrolled: string;
	exclusivityStart: string;
	exclusivityEnd: string;
	wholesaleDiscountPct: string;
	returnable: string;
};

export function listingFormValues(form: FormData): ListingFormValues {
	const get = (k: string) => String(form.get(k) ?? '').trim();
	return {
		status: get('status'),
		externalId: get('externalId'),
		price: get('price'),
		currency: get('currency').toUpperCase(),
		enrolled: get('enrolled'),
		exclusivityStart: get('exclusivityStart'),
		exclusivityEnd: get('exclusivityEnd'),
		wholesaleDiscountPct: get('wholesaleDiscountPct'),
		returnable: get('returnable')
	};
}

export type ListingInput = {
	status: ListingStatus;
	externalId: string | null;
	priceMinor: number | null;
	currency: string | null;
	enrolledInSelect: boolean;
	exclusivityStart: string | null;
	exclusivityEnd: string | null;
	wholesaleDiscountPct: number | null;
	returnable: boolean | null;
};

const date = z.iso.date('Use a full date');

export function parseListingForm(
	v: ListingFormValues,
	applies: { exclusive: boolean; printTerms: boolean }
):
	| { success: true; data: ListingInput }
	| { success: false; errors: Partial<Record<keyof ListingFormValues, string>> } {
	const errors: Partial<Record<keyof ListingFormValues, string>> = {};

	const status = z.enum(LISTING_STATUSES).safeParse(v.status);
	if (!status.success) errors.status = 'Choose a status';
	if (v.externalId.length > 64) errors.externalId = 'Keep the ID under 64 characters';

	let priceMinor: number | null = null;
	let currency: string | null = null;
	if (v.price) {
		if (!/^[A-Z]{3}$/.test(v.currency)) errors.currency = 'Choose a currency';
		else {
			priceMinor = toMinor(v.price, v.currency);
			currency = v.currency;
			if (priceMinor === null) errors.price = 'Use a price like 4.99';
		}
	}

	const enrolled = applies.exclusive && v.enrolled === 'on';
	let exclusivityStart: string | null = null;
	let exclusivityEnd: string | null = null;
	if (enrolled) {
		if (!date.safeParse(v.exclusivityStart).success)
			errors.exclusivityStart = 'When did this term start?';
		else exclusivityStart = v.exclusivityStart;
		if (!date.safeParse(v.exclusivityEnd).success)
			errors.exclusivityEnd = 'When does this term end?';
		else exclusivityEnd = v.exclusivityEnd;
		if (exclusivityStart && exclusivityEnd && exclusivityEnd < exclusivityStart) {
			errors.exclusivityEnd = 'The end comes before the start';
		}
	}

	let wholesaleDiscountPct: number | null = null;
	let returnable: boolean | null = null;
	if (applies.printTerms) {
		if (v.wholesaleDiscountPct) {
			const pct = Number(v.wholesaleDiscountPct);
			if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
				errors.wholesaleDiscountPct = 'Use a whole number from 0 to 100';
			} else wholesaleDiscountPct = pct;
		}
		returnable = v.returnable === 'yes' ? true : v.returnable === 'no' ? false : null;
	}

	if (Object.keys(errors).length > 0) return { success: false, errors };
	return {
		success: true,
		data: {
			status: status.data!,
			externalId: v.externalId || null,
			priceMinor,
			currency,
			enrolledInSelect: enrolled,
			exclusivityStart,
			exclusivityEnd,
			wholesaleDiscountPct,
			returnable
		}
	};
}
