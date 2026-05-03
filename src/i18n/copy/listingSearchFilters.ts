import type { ListingBrowseFilters } from '../../lib/listingsQuery';
import type { Locale } from '../locale';

export type ListingSearchFiltersCopy = {
	keywordLegend: string;
	countryLegend: string;
	typeLegend: string;
	priceLegend: string;
	search: string;
	countries: readonly { slug: ListingBrowseFilters['countrySlug']; label: string }[];
	types: readonly { slug: ListingBrowseFilters['propertyTypeSlug']; label: string }[];
	prices: readonly { value: string; label: string }[];
};

export const listingSearchFiltersUi: Record<Locale, ListingSearchFiltersCopy> = {
	de: {
		keywordLegend: 'Suchbegriff (optional)',
		countryLegend: 'Land',
		typeLegend: 'Typ',
		priceLegend: 'Max. Preis',
		search: 'Suchen',
		countries: [
			{ slug: '', label: 'Alle Länder' },
			{ slug: 'montenegro', label: 'Montenegro' },
			{ slug: 'cyprus', label: 'Zypern' },
			{ slug: 'north-cyprus', label: 'Nordzypern' },
			{ slug: 'turkey', label: 'Türkei' },
			{ slug: 'georgia', label: 'Georgien' },
			{ slug: 'bali', label: 'Bali' },
			{ slug: 'thailand', label: 'Thailand' },
		],
		types: [
			{ slug: '', label: 'Alle Typen' },
			{ slug: 'apartment', label: 'Wohnung · Apartment' },
			{ slug: 'house', label: 'Haus · Chalet' },
			{ slug: 'villa', label: 'Villa' },
			{ slug: 'penthouse', label: 'Penthouse' },
			{ slug: 'plot', label: 'Grundstück · Land' },
			{ slug: 'commercial', label: 'Gewerbe · Investment' },
		],
		prices: [
			{ value: '', label: 'Alle Preise' },
			{ value: '250000', label: 'bis 250.000 €' },
			{ value: '500000', label: 'bis 500.000 €' },
			{ value: '750000', label: 'bis 750.000 €' },
			{ value: '1000000', label: 'bis 1 Mio €' },
			{ value: '2000000', label: 'bis 2 Mio €' },
		],
	},
	en: {
		keywordLegend: 'Keyword (optional)',
		countryLegend: 'Country',
		typeLegend: 'Type',
		priceLegend: 'Max. price',
		search: 'Search',
		countries: [
			{ slug: '', label: 'All countries' },
			{ slug: 'montenegro', label: 'Montenegro' },
			{ slug: 'cyprus', label: 'Cyprus' },
			{ slug: 'north-cyprus', label: 'Northern Cyprus' },
			{ slug: 'turkey', label: 'Turkey' },
			{ slug: 'georgia', label: 'Georgia' },
			{ slug: 'bali', label: 'Bali' },
			{ slug: 'thailand', label: 'Thailand' },
		],
		types: [
			{ slug: '', label: 'All types' },
			{ slug: 'apartment', label: 'Apartment · flat' },
			{ slug: 'house', label: 'House · chalet' },
			{ slug: 'villa', label: 'Villa' },
			{ slug: 'penthouse', label: 'Penthouse' },
			{ slug: 'plot', label: 'Land · plot' },
			{ slug: 'commercial', label: 'Commercial · investment' },
		],
		prices: [
			{ value: '', label: 'Any budget' },
			{ value: '250000', label: 'up to €250,000' },
			{ value: '500000', label: 'up to €500,000' },
			{ value: '750000', label: 'up to €750,000' },
			{ value: '1000000', label: 'up to €1M' },
			{ value: '2000000', label: 'up to €2M' },
		],
	},
};

export const homeRegionListingSlugs: readonly ListingBrowseFilters['countrySlug'][] = [
	'montenegro',
	'cyprus',
	'north-cyprus',
	'turkey',
	'georgia',
	'bali',
	'thailand',
];
