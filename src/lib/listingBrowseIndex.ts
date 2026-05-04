import type { Listing, ListingInput } from './types';
import { LISTING_BROWSE_TYPE_SLUGS, listingMatchesBrowseCountry, listingMatchesBrowsePropertyType } from './listingsQuery';
import { listingPrimaryAmountEuro } from './listingPriceDisplay';

/** Felder für Firestore-Abfragen (Paginierung / Sortierung). */
export type ListingBrowseIndexFields = {
	browseCountryKey: string;
	browseTypeKey: string;
	sortCreatedAtMs: number;
	sortPricePrimary: number;
	bedroomsNum: number;
	cityLower: string;
};

/** Reihenfolge: Nordzypern vor allgemeinem „Cyprus“-Substring. */
const COUNTRY_PRIORITY = ['north-cyprus', 'montenegro', 'cyprus', 'turkey', 'georgia', 'bali', 'thailand'] as const;

export function deriveBrowseCountryKey(item: Listing | (Partial<Listing> & ListingInput)): string {
	const li = item as Listing;
	for (const slug of COUNTRY_PRIORITY) {
		if (listingMatchesBrowseCountry(li, slug)) return slug;
	}
	return '';
}

export function deriveBrowseTypeKey(item: Listing | (Partial<Listing> & ListingInput)): string {
	const li = item as Listing;
	for (const slug of LISTING_BROWSE_TYPE_SLUGS) {
		if (slug && listingMatchesBrowsePropertyType(li, slug)) return slug;
	}
	return '';
}

export function buildListingBrowseIndexFields(
	item: Partial<Listing> & ListingInput & { createdAt?: Listing['createdAt'] },
): ListingBrowseIndexFields {
	const li = item as Listing;
	const browseCountryKey = deriveBrowseCountryKey(li);
	const browseTypeKey = deriveBrowseTypeKey(li);
	const primary = listingPrimaryAmountEuro(li);
	const sortPricePrimary =
		primary != null && Number.isFinite(primary) && primary >= 0 ? Math.min(Math.floor(primary), 999_999_999) : -1;
	const br = item.bedrooms ?? item.rooms;
	let bedroomsNum = -1;
	if (br != null && Number.isFinite(br) && br >= 0) bedroomsNum = Math.min(50, Math.floor(Number(br)));
	const cityLower = normalizedCityKey(item.city ?? '');
	const sortCreatedAtMs =
		item.createdAt?.seconds != null ? item.createdAt.seconds * 1000 : Math.min(Date.now(), 9_000_000_000_000);
	return { browseCountryKey, browseTypeKey, sortPricePrimary, bedroomsNum, cityLower, sortCreatedAtMs };
}

function normalizedCityKey(raw: string): string {
	const t = raw.trim();
	if (!t) return '';
	return t
		.normalize('NFKD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase();
}

/** In Schreibpfade einbinden (Admin, Parser). */
export function withListingBrowseIndex<T extends Record<string, unknown>>(row: T): T & ListingBrowseIndexFields {
	const idx = buildListingBrowseIndexFields(row as Partial<Listing> & ListingInput & { createdAt?: Listing['createdAt'] });
	return { ...row, ...idx };
}
