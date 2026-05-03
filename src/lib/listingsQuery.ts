import type { Listing } from './types';

export function listingMatchesQuery(item: Listing, raw: string): boolean {
	const q = raw.trim().toLowerCase();
	if (!q) return true;
	const hay = [
		item.title,
		item.description,
		item.city,
		item.zip,
		item.street,
		item.country,
		item.propertyType,
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	const tokens = q.split(/\s+/).filter(Boolean);
	return tokens.every((t) => hay.includes(t));
}

/** URL-Parameter für die Übersicht: `country`, `type`, `price_max`; plus optional `q` */
export const LISTING_BROWSE_COUNTRY_SLUGS = ['montenegro', 'cyprus', 'north-cyprus', 'turkey', 'georgia', 'bali', 'thailand'] as const;

export const LISTING_BROWSE_TYPE_SLUGS = ['apartment', 'house', 'villa', 'penthouse', 'plot', 'commercial'] as const;

export type ListingBrowseFilters = {
	q: string;
	countrySlug: (typeof LISTING_BROWSE_COUNTRY_SLUGS)[number] | '';
	propertyTypeSlug: (typeof LISTING_BROWSE_TYPE_SLUGS)[number] | '';
	priceMax: number | null;
};

const COUNTRY_SYNONYMS = {
	montenegro: ['montenegro'],
	cyprus: ['cyprus', 'zypern', 'zyp'],
	'north-cyprus': ['nordzypern', 'northern cyprus', 'north cyprus', 'northcyprus'],
	turkey: ['türkei', 'turkey', 'turkiye', 'istanbul', 'bodrum'],
	georgia: ['georgia', 'georgien', 'batumi', 'tiflis', 'tbilisi'],
	bali: ['bali'],
	thailand: ['thailand'],
} as const satisfies Record<(typeof LISTING_BROWSE_COUNTRY_SLUGS)[number], readonly string[]>;

const PROPERTY_TYPE_HINTS = {
	apartment: ['apartment', 'wohnung', 'duplex', 'loft'],
	house: ['house', 'haus', 'chalet', 'familienhaus'],
	villa: ['villa'],
	penthouse: ['penthouse'],
	plot: ['plot', 'land', 'grundstück', 'terrain', 'grund'],
	commercial: ['commercial', 'investment', 'shop', 'büro', 'office', 'gewerbe', 'hotel'],
} as const satisfies Record<(typeof LISTING_BROWSE_TYPE_SLUGS)[number], readonly string[]>;

export function normalizedHaystack(parts: readonly string[]): string {
	return parts
		.filter(Boolean)
		.join(' ')
		.normalize('NFKD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase();
}

function listingMatchesCountry(item: Listing, slug: ListingBrowseFilters['countrySlug']): boolean {
	if (!slug) return true;
	const syns = COUNTRY_SYNONYMS[slug];
	const hay = normalizedHaystack([item.country, item.city, item.title, item.description]);
	return syns.some((s) => hay.includes(normalizedHaystack([s])));
}

function listingMatchesPropertyTypeSlug(item: Listing, slug: ListingBrowseFilters['propertyTypeSlug']): boolean {
	if (!slug) return true;
	const hints = PROPERTY_TYPE_HINTS[slug];
	const pt = normalizedHaystack([item.propertyType]);
	return hints.some((h) => pt.includes(normalizedHaystack([h])));
}

/** Schließt keine „Preis auf Anfrage“-Objekte aus (priceEuro === null bleiben sichtbar). */
export function listingMatchesBudgetMax(item: Listing, priceMax: number | null): boolean {
	if (priceMax == null || !Number.isFinite(priceMax)) return true;
	const p = item.priceEuro;
	if (p == null) return true;
	return p <= priceMax;
}

export function sanitizeListingBrowseFilters(params: URLSearchParams): ListingBrowseFilters {
	const q = (params.get('q') ?? '').trim().slice(0, 280);
	const c = params.get('country') ?? '';
	const countrySlug = (LISTING_BROWSE_COUNTRY_SLUGS as readonly string[]).includes(c) ? (c as ListingBrowseFilters['countrySlug']) : '';
	const t = params.get('type') ?? '';
	const propertyTypeSlug = (LISTING_BROWSE_TYPE_SLUGS as readonly string[]).includes(t)
		? (t as ListingBrowseFilters['propertyTypeSlug'])
		: '';

	let priceMax: number | null = null;
	const pm = params.get('price_max');
	if (pm != null && pm !== '') {
		const n = Number(pm);
		if (Number.isFinite(n) && n > 0) priceMax = Math.min(Math.floor(n), 999_999_999);
	}

	return { q, countrySlug, propertyTypeSlug, priceMax };
}

export function hasActiveListingBrowseFilters(f: ListingBrowseFilters): boolean {
	return Boolean(f.q.trim() || f.countrySlug || f.propertyTypeSlug || f.priceMax != null);
}

export function listingMatchesBrowseFilters(item: Listing, f: ListingBrowseFilters): boolean {
	if (f.q.trim() && !listingMatchesQuery(item, f.q)) return false;
	if (!listingMatchesCountry(item, f.countrySlug)) return false;
	if (!listingMatchesPropertyTypeSlug(item, f.propertyTypeSlug)) return false;
	if (!listingMatchesBudgetMax(item, f.priceMax)) return false;
	return true;
}
