// Money (spec §2, invariant 6): stored as integer minor units plus a currency code, never
// converted between currencies. These helpers turn form input like "4.99" into 499 and
// back, using each currency's own number of decimal places (JPY has none).

/** Currencies offered in forms. Any ISO 4217 code is valid in the database. */
export const COMMON_CURRENCIES = [
	'USD',
	'GBP',
	'EUR',
	'CAD',
	'AUD',
	'NZD',
	'INR',
	'JPY',
	'BRL',
	'MXN'
] as const;

/** Decimal places for a currency, from the platform's own currency data. */
export function currencyDigits(currency: string): number {
	return (
		new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

/** "4.99" in USD → 499; "500" in JPY → 500. Null for blank or invalid input. */
export function toMinor(amount: string, currency: string): number | null {
	const text = amount.trim().replace(/,/g, '');
	const digits = currencyDigits(currency);
	const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
	if (!pattern.test(text)) return null;
	const [whole, fraction = ''] = text.split('.');
	return Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || 0);
}

/** 499 in USD → "4.99", for refilling a form. */
export function fromMinor(minor: number, currency: string): string {
	const digits = currencyDigits(currency);
	return digits === 0 ? String(minor) : (minor / 10 ** digits).toFixed(digits);
}

/** 499 in USD → "$4.99", for display. */
export const formatMoney = (minor: number, currency: string) =>
	new Intl.NumberFormat('en', { style: 'currency', currency }).format(
		minor / 10 ** currencyDigits(currency)
	);
