import type { Listing } from './types';
import { listingEffectiveEuroForBudgetMax } from './listingPriceDisplay';

export const LISTINGS_CATALOG_PAGE_SIZE = 50;

export function encodeListingCatalogCursor(item: Listing, sort: ListingBrowseSortKey): string {
	const id = item.id ?? '';
	if (!id) return '';
	if (sort === 'price_asc' || sort === 'price_desc') {
		const v = item.sortPricePrimary ?? -1;
		return `${v}|${id}`;
	}
	const ms = item.sortCreatedAtMs ?? (item.createdAt?.seconds != null ? item.createdAt.seconds * 1000 : 0);
	return `${ms}|${id}`;
}

export function parseListingCatalogCursor(raw: string): { v: number; id: string } | null {
	const s = raw.trim();
	const i = s.lastIndexOf('|');
	if (i <= 0) return null;
	const id = s.slice(i + 1).trim();
	const v = Number(s.slice(0, i));
	if (!id || !Number.isFinite(v)) return null;
	return { v, id };
}

export type ListingBrowseSortKey = 'created_desc' | 'created_asc' | 'price_desc' | 'price_asc';

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
	priceMin: number | null;
	bedroomsMin: number | null;
	city: string;
	featuredOnly: boolean;
	sort: ListingBrowseSortKey;
	/** Cursor: `${sortValue}|${firestoreDocId}` für die nächste Seite */
	after: string;
	/** Nur Legacy-Pfad (ohne Index-Felder): 1-basiert */
	page: number;
};

const COUNTRY_SYNONYMS = {
	montenegro: ['montenegro', 'crna gora', 'црна гора'],
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

/** Textgrundlage für Länder-Filter inkl. Feed-Metadaten (trennt z. B. Adriom/ME vs. Nordzypern-Feed). */
export function listingBrowseCountryHaystack(item: Listing): string {
	return normalizedHaystack([
		item.country,
		item.city,
		item.street,
		item.title,
		item.description,
		item.xmlFeedSource,
		item.xmlFeedSourceUrl,
		item.source,
		item.externalId,
	]);
}

/** Signale TRNC / Nordzypern — vor dem generischen Substring „cyprus“. */
const NORTH_CYPRUS_HAY_MARKERS = [
	'nordzypern',
	'northern cyprus',
	'north cyprus',
	'northcyprus',
	'kktc',
	'trnc',
	'northcyprusinvest',
	'girne',
	'kyrenia',
	'famagusta',
	'gazimagusa',
	'magusa',
	'iskele',
	'alsancak',
	'catalkoy',
	'ozankoy',
	'bogaz',
	'tatlisu',
	'bafra',
	'esentepe',
	'bahceli',
	'kuzey kibris',
	'северный кипр',
	'prian.php',
] as const;

export function haystackImpliesNorthCyprus(hay: string): boolean {
	for (const raw of NORTH_CYPRUS_HAY_MARKERS) {
		const needle = normalizedHaystack([raw]);
		if (needle && hay.includes(needle)) return true;
	}
	return false;
}

/** Bekannte Nordzypern-Feed-URL beim Import (Admin). */
export function feedUrlSuggestsNorthCyprus(feedUrl: string): boolean {
	return haystackImpliesNorthCyprus(normalizedHaystack([feedUrl.trim()]));
}

function listingIsAdriomCatalog(item: Listing): boolean {
	return item.source === 'adriom';
}

export function listingMatchesBrowseCountry(item: Listing, slug: ListingBrowseFilters['countrySlug']): boolean {
	if (!slug) return true;
	const hay = listingBrowseCountryHaystack(item);
	const north = haystackImpliesNorthCyprus(hay);
	const adriom = listingIsAdriomCatalog(item);

	if (slug === 'montenegro') {
		if (north) return false;
		if (adriom) return true;
		return COUNTRY_SYNONYMS.montenegro.some((s) => hay.includes(normalizedHaystack([s])));
	}

	if (slug === 'north-cyprus') {
		if (north) return true;
		return COUNTRY_SYNONYMS['north-cyprus'].some((s) => hay.includes(normalizedHaystack([s])));
	}

	if (slug === 'cyprus') {
		if (north) return false;
		return COUNTRY_SYNONYMS.cyprus.some((s) => hay.includes(normalizedHaystack([s])));
	}

	const syns = COUNTRY_SYNONYMS[slug];
	return syns.some((s) => hay.includes(normalizedHaystack([s])));
}

export function listingMatchesBrowsePropertyType(item: Listing, slug: ListingBrowseFilters['propertyTypeSlug']): boolean {
	if (!slug) return true;
	const hints = PROPERTY_TYPE_HINTS[slug];
	const pt = normalizedHaystack([item.propertyType]);
	return hints.some((h) => pt.includes(normalizedHaystack([h])));
}

/** Schließt keine „Preis auf Anfrage“-Objekte aus (priceEuro === null bleiben sichtbar). */
export function listingMatchesBudgetMax(item: Listing, priceMax: number | null): boolean {
	if (priceMax == null || !Number.isFinite(priceMax)) return true;
	const p = listingEffectiveEuroForBudgetMax(item);
	if (p == null) return true;
	return p <= priceMax;
}

export function listingMatchesBudgetMin(item: Listing, priceMin: number | null): boolean {
	if (priceMin == null || !Number.isFinite(priceMin)) return true;
	const p = listingEffectiveEuroForBudgetMax(item);
	if (p == null) return false;
	return p >= priceMin;
}

function listingCityMatchesNeedle(item: Listing, raw: string): boolean {
	const n = raw.trim();
	if (!n) return true;
	const hay = normalizedHaystack([item.city, item.zip, item.street]);
	return hay.includes(normalizedHaystack([n]));
}

function listingBedroomsMinOk(item: Listing, min: number | null): boolean {
	if (min == null || !Number.isFinite(min) || min <= 0) return true;
	const n = item.bedrooms ?? item.rooms;
	if (n == null || !Number.isFinite(n)) return false;
	return n >= min;
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

	let priceMin: number | null = null;
	const pmin = params.get('price_min');
	if (pmin != null && pmin !== '') {
		const n = Number(pmin);
		if (Number.isFinite(n) && n > 0) priceMin = Math.min(Math.floor(n), 999_999_999);
	}

	let bedroomsMin: number | null = null;
	const bd = params.get('bedrooms_min');
	if (bd != null && bd !== '') {
		const n = Number(bd);
		if (Number.isFinite(n) && n > 0) bedroomsMin = Math.min(Math.floor(n), 50);
	}

	const city = (params.get('city') ?? '').trim().slice(0, 120);
	const featuredOnly = params.get('featured') === '1';

	const sortRaw = (params.get('sort') ?? '').trim();
	const sortAllowed: ListingBrowseSortKey[] = ['created_desc', 'created_asc', 'price_desc', 'price_asc'];
	const sort = (sortAllowed as readonly string[]).includes(sortRaw) ? (sortRaw as ListingBrowseSortKey) : 'created_desc';

	const after = (params.get('after') ?? '').trim().slice(0, 320);

	let page = 1;
	const pg = params.get('page');
	if (pg != null && pg !== '') {
		const n = parseInt(pg, 10);
		if (Number.isFinite(n) && n > 0) page = Math.min(n, 5000);
	}

	return { q, countrySlug, propertyTypeSlug, priceMax, priceMin, bedroomsMin, city, featuredOnly, sort, after, page };
}

export function hasActiveListingBrowseFilters(f: ListingBrowseFilters): boolean {
	return Boolean(
		f.q.trim() ||
			f.countrySlug ||
			f.propertyTypeSlug ||
			f.priceMax != null ||
			f.priceMin != null ||
			f.bedroomsMin != null ||
			f.city.trim() ||
			f.featuredOnly ||
			f.sort !== 'created_desc',
	);
}

export function listingMatchesBrowseFilters(item: Listing, f: ListingBrowseFilters): boolean {
	if (f.q.trim() && !listingMatchesQuery(item, f.q)) return false;
	if (!listingMatchesBrowseCountry(item, f.countrySlug)) return false;
	if (!listingMatchesBrowsePropertyType(item, f.propertyTypeSlug)) return false;
	if (!listingMatchesBudgetMax(item, f.priceMax)) return false;
	if (!listingMatchesBudgetMin(item, f.priceMin)) return false;
	if (!listingBedroomsMinOk(item, f.bedroomsMin)) return false;
	if (!listingCityMatchesNeedle(item, f.city)) return false;
	if (f.featuredOnly && !item.featured) return false;
	return true;
}
