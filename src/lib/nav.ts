import { resolve } from '$app/paths';

/** `href` is already resolved (base path included), so it can go straight into a link. */
export type NavItem = { href: string; label: string; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
	{
		items: [
			{ href: resolve('/'), label: 'Home', exact: true },
			{ href: resolve('/books'), label: 'Books' },
			{ href: resolve('/listings'), label: 'Listings' },
			{ href: resolve('/tasks'), label: 'Tasks' }
		]
	},
	{
		label: 'Money',
		items: [
			{ href: resolve('/ads'), label: 'Ads' },
			{ href: resolve('/reports'), label: 'Reports' },
			{ href: resolve('/decisions'), label: 'Decisions' }
		]
	},
	{ label: 'Rhythm', items: [{ href: resolve('/cadence'), label: 'Cadence' }] }
];

export const SETTINGS: NavItem = { href: resolve('/settings'), label: 'Settings' };

/** `href` is the resolved path, so this stays correct under a base path. */
export function isCurrent(href: string, pathname: string, exact = false): boolean {
	return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
