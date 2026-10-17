/**
 * A safe place to send the author back to after a form, from a `return` query param.
 * Only paths within this app: a leading single slash, no scheme, no protocol-relative
 * "//host", so a crafted link can't redirect someone off-site.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
		return null;
	try {
		const url = new URL(value, 'http://app.invalid');
		return url.origin === 'http://app.invalid' ? `${url.pathname}${url.search}` : null;
	} catch {
		return null;
	}
}
