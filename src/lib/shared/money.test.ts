import { describe, expect, it } from 'vitest';
import { currencyDigits, formatMoney, fromMinor, toMinor } from './money';

describe('money', () => {
	it("knows each currency's decimal places", () => {
		expect(currencyDigits('USD')).toBe(2);
		expect(currencyDigits('JPY')).toBe(0);
	});

	it.each([
		['4.99', 'USD', 499],
		['4.9', 'USD', 490],
		['5', 'USD', 500],
		['1,299.00', 'USD', 129900],
		[' 0.99 ', 'GBP', 99],
		['500', 'JPY', 500]
	])('reads %s %s as %d', (amount, currency, minor) => {
		expect(toMinor(amount, currency)).toBe(minor);
	});

	it.each([
		['', 'USD'],
		['4.999', 'USD'],
		['-1', 'USD'],
		['abc', 'USD'],
		['500.5', 'JPY']
	])('rejects %j in %s', (amount, currency) => {
		expect(toMinor(amount, currency)).toBeNull();
	});

	it('writes minor units back for forms and display', () => {
		expect(fromMinor(499, 'USD')).toBe('4.99');
		expect(fromMinor(500, 'JPY')).toBe('500');
		expect(formatMoney(499, 'USD')).toBe('$4.99');
		expect(formatMoney(500, 'JPY')).toBe('¥500');
	});
});
