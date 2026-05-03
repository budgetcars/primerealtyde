export type Locale = 'de' | 'en';

/** Routes that exist under DE root and under `/en/` (same path suffix). */
const mirroredCanonical = new Set([
	'/',
	'/immobilien',
	'/immobilie',
	'/kontakt',
	'/ueber-uns',
	'/partner',
	'/impressum',
	'/datenschutz',
	'/agb',
	'/nutzungsbedingungen',
	'/verwaltung',
]);

export function getLocale(pathname: string): Locale {
	return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'de';
}

/** Path without `/en` prefix; `/en` and `/en/` → `/`. */
export function stripLocalePrefix(pathname: string): string {
	if (pathname === '/en') return '/';
	if (pathname.startsWith('/en/')) {
		const rest = pathname.slice(3);
		return rest === '' ? '/' : rest;
	}
	return pathname;
}

export function withLocalePath(pathname: string, locale: Locale): string {
	if (locale === 'de') return pathname === '' ? '/' : pathname;
	if (pathname === '/') return '/en/';
	return `/en${pathname}`;
}

export function pathHasLocaleMirror(pathnameSansLocale: string): boolean {
	return mirroredCanonical.has(pathnameSansLocale);
}

/** Toggle language; unmirrorable paths fall back to that locale’s home. */
export function switchLocaleHref(pathname: string, search: string, target: Locale): string {
	const base = stripLocalePrefix(pathname);
	if (!pathHasLocaleMirror(base)) {
		return `${withLocalePath('/', target)}${search || ''}`;
	}
	return `${withLocalePath(base, target)}${search || ''}`;
}
