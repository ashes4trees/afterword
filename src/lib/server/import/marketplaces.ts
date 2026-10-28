// Amazon storefronts as they appear in KDP reports (#21), mapped to the ISO 3166-1
// country codes the app uses for marketplaces, and the currency each pays in.
export const AMAZON_MARKETPLACES: Record<string, { country: string; currency: string }> = {
	'Amazon.com': { country: 'US', currency: 'USD' },
	'Amazon.co.uk': { country: 'GB', currency: 'GBP' },
	'Amazon.de': { country: 'DE', currency: 'EUR' },
	'Amazon.fr': { country: 'FR', currency: 'EUR' },
	'Amazon.es': { country: 'ES', currency: 'EUR' },
	'Amazon.it': { country: 'IT', currency: 'EUR' },
	'Amazon.nl': { country: 'NL', currency: 'EUR' },
	'Amazon.com.be': { country: 'BE', currency: 'EUR' },
	'Amazon.ie': { country: 'IE', currency: 'EUR' },
	'Amazon.co.jp': { country: 'JP', currency: 'JPY' },
	'Amazon.in': { country: 'IN', currency: 'INR' },
	'Amazon.ca': { country: 'CA', currency: 'CAD' },
	'Amazon.com.br': { country: 'BR', currency: 'BRL' },
	'Amazon.com.mx': { country: 'MX', currency: 'MXN' },
	'Amazon.com.au': { country: 'AU', currency: 'AUD' },
	'Amazon.pl': { country: 'PL', currency: 'PLN' },
	'Amazon.se': { country: 'SE', currency: 'SEK' }
};
