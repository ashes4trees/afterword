import type { RouteId } from '$app/types';

export type NavItem = { href: RouteId; label: string };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
	{
		items: [
			{ href: '/', label: 'Home' },
			{ href: '/books', label: 'Books' },
			{ href: '/listings', label: 'Listings' },
			{ href: '/tasks', label: 'Tasks' }
		]
	},
	{
		label: 'Money',
		items: [
			{ href: '/ads', label: 'Ads' },
			{ href: '/reports', label: 'Reports' },
			{ href: '/decisions', label: 'Decisions' }
		]
	},
	{ label: 'Rhythm', items: [{ href: '/cadence', label: 'Cadence' }] }
];

export const SETTINGS: NavItem = { href: '/settings', label: 'Settings' };

/** `href` is the resolved path, so this stays correct under a base path. */
export function isCurrent(href: string, pathname: string, exact = false): boolean {
	return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
