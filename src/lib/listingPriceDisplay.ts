import type { Listing, ListingInput } from './types';
import type { Locale } from '../i18n/locale';
import { numberingLocale } from '../i18n/locale';
import { listingsUi } from '../i18n/copy/listingsUi';

/** Felder für Karten-, Karten-Popup- und Filterlogik */
export type ListingPriceFields = Pick<Listing, 'priceEuro' | 'pricePerMonthEuro' | 'listingType'>;

function isRentListingType(lt: string | undefined): boolean {
	const t = (lt || '').toLowerCase();
	return t === 'rent' || t === 'rental' || t === 'miete' || t === 'lease';
}

/** Anzeige als Monatsmiete (Kaufpreis-Zeile entfällt). */
export function listingPriceIsMonthly(li: ListingPriceFields): boolean {
	return (
		isRentListingType(li.listingType) &&
		li.pricePerMonthEuro != null &&
		Number.isFinite(li.pricePerMonthEuro) &&
		li.pricePerMonthEuro > 0
	);
}

/**
 * Monats-/Miet-Anzeige inkl. Suffix („/ Monat“): expliziter Miettyp oder nur `pricePerMonthEuro` ohne Kaufpreis.
 * Für Detailseite z. B. €/m² ausblenden.
 */
export function listingPrimaryUsesMonthlySuffix(li: ListingPriceFields): boolean {
	if (listingPriceIsMonthly(li)) return true;
	const pm = li.pricePerMonthEuro;
	const pe = li.priceEuro;
	if (pm != null && Number.isFinite(pm) && pm > 0 && (pe == null || !Number.isFinite(pe) || pe <= 0)) return true;
	return false;
}

/**
 * Betrag für die Hauptpreiszeile: bei Miete mit `pricePerMonthEuro` der Monatsbetrag, sonst Kaufpreis.
 */
export function listingPrimaryAmountEuro(li: ListingPriceFields): number | null {
	if (listingPriceIsMonthly(li)) return li.pricePerMonthEuro ?? null;
	if (li.priceEuro != null && Number.isFinite(li.priceEuro) && li.priceEuro > 0) return li.priceEuro;
	if (li.pricePerMonthEuro != null && Number.isFinite(li.pricePerMonthEuro) && li.pricePerMonthEuro > 0)
		return li.pricePerMonthEuro;
	if (li.priceEuro != null && Number.isFinite(li.priceEuro)) return li.priceEuro;
	return null;
}

/** Filter „max. Budget“: Miete nach Monat, Verkauf nach Kaufpreis (analog Hauptpreisanzeige). */
export function listingEffectiveEuroForBudgetMax(item: Listing): number | null {
	if (listingPrimaryUsesMonthlySuffix(item)) return listingPrimaryAmountEuro(item);
	const p = item.priceEuro;
	if (p != null && p > 0) return p;
	return null;
}

function formatCurrencyAmt(amt: number, locale: Locale): string {
	const num = numberingLocale(locale);
	return new Intl.NumberFormat(num, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amt);
}

/** Karten, Liste, Detail: einheitliche Preiszeile */
export function formatListingPricePrimary(li: Listing | ListingInput, locale: Locale): string {
	const L = listingsUi[locale];
	const amt = listingPrimaryAmountEuro(li);
	if (amt == null) return L.priceOnRequest;
	const cur = formatCurrencyAmt(amt, locale);
	return listingPrimaryUsesMonthlySuffix(li) ? `${cur}${L.pricePerMonthSuffix}` : cur;
}

/** Kompakt (Karten-Popup) */
export function formatListingPriceShort(li: Listing | ListingInput, locale: Locale): string {
	return formatListingPricePrimary(li, locale);
}
