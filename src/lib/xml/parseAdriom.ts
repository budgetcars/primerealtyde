import type { ListingInput } from '../types';
import { withListingBrowseIndex } from '../listingBrowseIndex';

function text(el: Element | null | undefined): string {
	return el?.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

function parseNum(raw: string): number | null {
	if (!raw) return null;
	const n = parseFloat(String(raw).replace(/\s/g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

function pickTitle(listingEl: Element, preferredLangs: string[]): string {
	const titlesRoot = listingEl.getElementsByTagName('titles')[0];
	if (!titlesRoot) return 'Immobilie';
	const titleEls = titlesRoot.getElementsByTagName('title');
	const byLang = new Map<string, string>();
	for (let i = 0; i < titleEls.length; i++) {
		const el = titleEls[i]!;
		const lang = (el.getAttribute('lang') || 'und').toLowerCase();
		const t = text(el);
		if (t) byLang.set(lang, t);
	}
	for (const l of preferredLangs) {
		const v = byLang.get(l.toLowerCase());
		if (v) return v;
	}
	const first = byLang.values().next().value as string | undefined;
	return first || 'Immobilie';
}

function pickDescription(listingEl: Element, preferredLangs: string[]): string {
	const descRoot = listingEl.getElementsByTagName('descriptions')[0];
	if (!descRoot) return '';
	const descEls = descRoot.getElementsByTagName('description');
	const byLang = new Map<string, string>();
	for (let i = 0; i < descEls.length; i++) {
		const el = descEls[i]!;
		const lang = (el.getAttribute('lang') || 'und').toLowerCase();
		const t = el.textContent?.trim() ?? '';
		if (t) byLang.set(lang, t);
	}
	for (const l of preferredLangs) {
		const v = byLang.get(l.toLowerCase());
		if (v) return v;
	}
	const first = byLang.values().next().value as string | undefined;
	return first || '';
}

function collectImages(listingEl: Element): string[] {
	const imagesRoot = listingEl.getElementsByTagName('images')[0];
	if (!imagesRoot) return [];
	const imgs = Array.from(imagesRoot.getElementsByTagName('image'));
	imgs.sort((a, b) => {
		const pa = parseInt(a.getAttribute('position') || '0', 10);
		const pb = parseInt(b.getAttribute('position') || '0', 10);
		return pa - pb;
	});
	return imgs.map((n) => text(n)).filter(Boolean);
}

function collectFeatures(listingEl: Element): string[] {
	const featRoot = listingEl.getElementsByTagName('features')[0];
	if (!featRoot) return [];
	return Array.from(featRoot.getElementsByTagName('feature'))
		.map((f) => text(f))
		.filter(Boolean);
}

function parseListingElement(
	listingEl: Element,
	feedMeta: { source?: string; sourceUrl?: string; generated?: string },
	preferredLangs: string[],
): (ListingInput & { firestoreDocumentId: string }) | null {
	const id = listingEl.getAttribute('id')?.trim();
	if (!id) return null;

	const listingUrl = text(listingEl.getElementsByTagName('url')[0]);
	const listingType = text(listingEl.getElementsByTagName('listingType')[0]);
	const propertyType = text(listingEl.getElementsByTagName('propertyType')[0]) || 'property';
	const featuredRaw = text(listingEl.getElementsByTagName('featured')[0]).toLowerCase();
	const featured = featuredRaw === 'true' || featuredRaw === '1';

	const countryRaw = text(listingEl.getElementsByTagName('country')[0]);
	const country = countryRaw.trim() || 'Montenegro';
	const city = text(listingEl.getElementsByTagName('city')[0]);

	const priceEl = listingEl.getElementsByTagName('price')[0];
	const priceEuro = priceEl ? parseNum(text(priceEl)) : null;
	const currency = priceEl?.getAttribute('currency') || 'EUR';
	const pricePerMonthEl = listingEl.getElementsByTagName('pricePerMonth')[0];
	const pricePerMonthEuro = pricePerMonthEl ? parseNum(text(pricePerMonthEl)) : null;

	const priceSqmEl = listingEl.getElementsByTagName('pricePerSqm')[0];
	const pricePerSqmEuro = priceSqmEl ? parseNum(text(priceSqmEl)) : null;

	const spec = listingEl.getElementsByTagName('specifications')[0];
	let bedrooms: number | null = null;
	let bathrooms: number | null = null;
	let livingSpaceSqm: number | null = null;
	if (spec) {
		bedrooms = parseNum(text(spec.getElementsByTagName('bedrooms')[0]));
		bathrooms = parseNum(text(spec.getElementsByTagName('bathrooms')[0]));
		const areaEl = spec.getElementsByTagName('area')[0];
		if (areaEl) livingSpaceSqm = parseNum(text(areaEl));
	}

	const coords = listingEl.getElementsByTagName('coordinates')[0];
	let latitude: number | null = null;
	let longitude: number | null = null;
	if (coords) {
		latitude = parseNum(text(coords.getElementsByTagName('latitude')[0]));
		longitude = parseNum(text(coords.getElementsByTagName('longitude')[0]));
	}

	const dates = listingEl.getElementsByTagName('dates')[0];
	const remoteCreated = dates ? text(dates.getElementsByTagName('created')[0]) : '';
	const remoteUpdated = dates ? text(dates.getElementsByTagName('updated')[0]) : '';

	const title = pickTitle(listingEl, preferredLangs);
	const description = pickDescription(listingEl, preferredLangs);

	const rooms = bedrooms;

	const payload: ListingInput & { firestoreDocumentId: string } = {
		firestoreDocumentId: id,
		title,
		description,
		priceEuro,
		pricePerMonthEuro: pricePerMonthEuro ?? undefined,
		livingSpaceSqm,
		rooms,
		bedrooms,
		bathrooms,
		propertyType,
		city,
		zip: '',
		street: '',
		country,
		images: collectImages(listingEl),
		features: collectFeatures(listingEl),
		source: 'adriom',
		externalId: id,
		listingUrl: listingUrl || undefined,
		listingType: listingType || undefined,
		featured,
		pricePerSqmEuro,
		latitude,
		longitude,
		currency,
		xmlFeedSource: feedMeta.source,
		xmlFeedSourceUrl: feedMeta.sourceUrl,
		xmlFeedGeneratedAt: feedMeta.generated,
		remoteCreatedAt: remoteCreated || undefined,
		remoteUpdatedAt: remoteUpdated || undefined,
	};

	return withListingBrowseIndex(payload as unknown as Record<string, unknown>) as typeof payload;
}

export interface AdriomParseResult {
	feedMeta: {
		source?: string;
		sourceUrl?: string;
		generated?: string;
		count?: string;
	};
	items: (ListingInput & { firestoreDocumentId: string })[];
}

/**
 * Adriom `listings.xml` – z. B. https://adriom.me/api/listings.xml
 * `preferredLangs`: Reihenfolge für Titel/Beschreibung (z. B. ['de','en']).
 */
export function parseAdriomXml(xmlString: string, preferredLangs: string[] = ['de', 'en', 'sr', 'ru']): AdriomParseResult {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlString, 'text/xml');
	const parseError = doc.querySelector('parsererror');
	if (parseError) {
		throw new Error('XML konnte nicht gelesen werden.');
	}

	const root = doc.documentElement;
	if (!root || root.tagName.toLowerCase() !== 'listings') {
		throw new Error('Kein <listings>-Wurzelelement (Adriom-Format).');
	}

	const feedMeta = {
		source: root.getAttribute('source') || undefined,
		sourceUrl: root.getAttribute('sourceUrl') || undefined,
		generated: root.getAttribute('generated') || undefined,
		count: root.getAttribute('count') || undefined,
	};

	const items: (ListingInput & { firestoreDocumentId: string })[] = [];
	const listingNodes = doc.getElementsByTagName('listing');
	for (let i = 0; i < listingNodes.length; i++) {
		const el = listingNodes[i]!;
		const row = parseListingElement(el, feedMeta, preferredLangs);
		if (row) items.push(row);
	}

	return { feedMeta, items };
}

export function detectXmlRootTag(xmlString: string): 'listings' | 'openimmo' | 'unknown' {
	const t = xmlString.trim();
	if (!t) return 'unknown';
	const doc = new DOMParser().parseFromString(t, 'text/xml');
	if (doc.querySelector('parsererror')) return 'unknown';
	const name = doc.documentElement?.tagName?.toLowerCase();
	if (name === 'listings') return 'listings';
	if (name === 'openimmo') return 'openimmo';
	return 'unknown';
}
