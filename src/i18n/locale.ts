export type Locale = 'de' | 'en' | 'ru' | 'zh';

export const locales: readonly Locale[] = ['de', 'en', 'ru', 'zh'] as const;

/** Routes unter DE sowie unter `/en/`, `/ru/`, `/zh/` gleicher Pfadsuffix */
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

const secondaryLocales = ['en', 'ru', 'zh'] as const satisfies readonly Omit<Locale, 'de'>[];

export function getLocale(pathname: string): Locale {
	for (const l of secondaryLocales) {
		if (pathname === `/${l}` || pathname === `/${l}/` || pathname.startsWith(`/${l}/`)) {
			return l;
		}
	}
	return 'de';
}

/** Normalisierte Pfadbasis ohne Sprachprefix; immer mit führendem `/` */
export function stripLocalePrefix(pathname: string): string {
	for (const l of secondaryLocales) {
		const prefix = `/${l}`;
		if (pathname === prefix || pathname === `${prefix}/`) return '/';
		if (pathname.startsWith(`${prefix}/`)) {
			const tail = pathname.slice(prefix.length); // `/en/xyz` → `/xyz`
			return tail || '/';
		}
	}
	return pathname === '' ? '/' : pathname;
}

export function withLocalePath(pathname: string, locale: Locale): string {
	const raw = pathname === '' ? '/' : pathname;
	if (locale === 'de') return raw;
	const prefix = `/${locale}`;
	if (raw === '/') return `${prefix}/`;
	return `${prefix}${raw}`;
}

export function pathHasLocaleMirror(pathnameSansLocale: string): boolean {
	return mirroredCanonical.has(pathnameSansLocale);
}

/** Zur Zielsprache wechseln; ohne Mirror → Startseite in Zielsprache */
export function switchLocaleHref(pathname: string, search: string, target: Locale): string {
	const base = stripLocalePrefix(pathname);
	if (!pathHasLocaleMirror(base)) {
		return `${withLocalePath('/', target)}${search || ''}`;
	}
	return `${withLocalePath(base, target)}${search || ''}`;
}

export function localeHtmlLang(locale: Locale): string {
	if (locale === 'zh') return 'zh-CN';
	return locale;
}

export function localeHreflang(locale: Locale): string {
	if (locale === 'zh') return 'zh-CN';
	if (locale === 'ru') return 'ru-RU';
	if (locale === 'en') return 'en';
	return 'de';
}

export function localeOg(locale: Locale): string {
	switch (locale) {
		case 'en':
			return 'en_GB';
		case 'ru':
			return 'ru_RU';
		case 'zh':
			return 'zh_CN';
		default:
			return 'de_DE';
	}
}

export function numberingLocale(locale: Locale): string {
	switch (locale) {
		case 'en':
			return 'en-GB';
		case 'ru':
			return 'ru-RU';
		case 'zh':
			return 'zh-CN';
		default:
			return 'de-DE';
	}
}
