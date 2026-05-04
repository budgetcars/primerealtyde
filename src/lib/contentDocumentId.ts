import type { Locale } from '../i18n/locale';

export function normalizeContentSlug(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Stabiler Firestore-Dokumentname: `{locale}_{slug}` */
export function contentDocumentId(locale: Locale, slug: string): string {
	const s = normalizeContentSlug(slug);
	return `${locale}_${s}`;
}
