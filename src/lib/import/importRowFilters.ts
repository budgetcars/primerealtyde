import type { ListingInput } from '../types';
import { listingPrimaryAmountEuro } from '../listingPriceDisplay';

/**
 * Einfacher Vorfilter („Filtering Import Data“ / XPath-Äquivalent: nur Datensätze, die alle Regeln erfüllen).
 */
export type ImportRowPresetFilters = {
	minPriceEuro: number | null;
	maxPriceEuro: number | null;
	cityContains: string;
	countryContains: string;
	featuredOnly: boolean;
	requireImages: boolean;
};

export function defaultImportRowFilters(): ImportRowPresetFilters {
	return {
		minPriceEuro: null,
		maxPriceEuro: null,
		cityContains: '',
		countryContains: '',
		featuredOnly: false,
		requireImages: false,
	};
}

export function listingInputPassesImportFilters(li: ListingInput, f: ImportRowPresetFilters): boolean {
	if (f.featuredOnly && !li.featured) return false;
	if (f.requireImages && (!Array.isArray(li.images) || li.images.every((x) => !String(x).trim()))) return false;
	if (f.minPriceEuro != null) {
		const eff = listingPrimaryAmountEuro(li);
		if (eff == null || eff < f.minPriceEuro) return false;
	}
	if (f.maxPriceEuro != null) {
		const eff = listingPrimaryAmountEuro(li);
		if (eff == null || eff > f.maxPriceEuro) return false;
	}
	const cityN = f.cityContains.trim().toLowerCase();
	if (cityN && !(li.city ?? '').toLowerCase().includes(cityN)) return false;
	const countryN = f.countryContains.trim().toLowerCase();
	if (countryN && !(li.country ?? '').toLowerCase().includes(countryN)) return false;
	return true;
}
