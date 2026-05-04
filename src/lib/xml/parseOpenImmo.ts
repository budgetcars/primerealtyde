import type { ListingInput } from '../types';
import { withListingBrowseIndex } from '../listingBrowseIndex';

function text(el: Element | null | undefined): string {
	return el?.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}

function parseNum(raw: string): number | null {
	if (!raw) return null;
	const n = parseFloat(String(raw).replace(/\./g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

function findFirstText(root: Element, ...tags: string[]): string {
	for (const tag of tags) {
		const el = root.getElementsByTagName(tag)[0];
		if (el && text(el)) return text(el);
	}
	return '';
}

function collectImageUrls(immobilie: Element): string[] {
	const urls: string[] = [];
	const anhaenge = immobilie.getElementsByTagName('anhang');
	for (let i = 0; i < anhaenge.length; i++) {
		const a = anhaenge[i]!;
		const pfads = a.getElementsByTagName('pfad');
		for (let j = 0; j < pfads.length; j++) {
			const u = text(pfads[j]!);
			if (u && (u.startsWith('http') || u.startsWith('//'))) {
				urls.push(u.startsWith('//') ? `https:${u}` : u);
			}
		}
	}
	return [...new Set(urls)].slice(0, 24);
}

function pickGeo(immobilie: Element): { zip: string; city: string; street: string } {
	const geo = immobilie.getElementsByTagName('geo')[0];
	if (!geo) return { zip: '', city: '', street: '' };
	return {
		zip: findFirstText(geo, 'plz', 'land_plz'),
		city: findFirstText(geo, 'ort'),
		street: findFirstText(geo, 'strasse', 'hausnummer')
			? `${findFirstText(geo, 'strasse')} ${findFirstText(geo, 'hausnummer')}`.trim()
			: '',
	};
}

function pickPricing(immobilie: Element): {
	priceEuro: number | null;
	pricePerMonthEuro: number | null;
	listingType?: string;
} {
	const preise = immobilie.getElementsByTagName('preise')[0];
	if (!preise) return { priceEuro: null, pricePerMonthEuro: null };
	const kauf = text(preise.getElementsByTagName('kaufpreis')[0]);
	if (kauf) {
		const v = parseNum(kauf);
		return { priceEuro: v, pricePerMonthEuro: null };
	}
	const brutto = text(preise.getElementsByTagName('bruttokaufpreis')[0]);
	if (brutto) {
		const v = parseNum(brutto);
		return { priceEuro: v, pricePerMonthEuro: null };
	}
	const miet =
		text(preise.getElementsByTagName('kaltmiete')[0]) ||
		text(preise.getElementsByTagName('nettokaltmiete')[0]) ||
		text(preise.getElementsByTagName('warmmiete')[0]);
	if (miet) {
		const v = parseNum(miet);
		return { priceEuro: null, pricePerMonthEuro: v, listingType: 'rent' };
	}
	return { priceEuro: null, pricePerMonthEuro: null };
}

function pickTitleDesc(immobilie: Element): { title: string; description: string } {
	const frei = immobilie.getElementsByTagName('freitexte')[0];
	const title = frei
		? findFirstText(frei, 'objekttitel', 'ueberschrift')
		: findFirstText(immobilie, 'objekttitel');
	const desc = frei
		? findFirstText(frei, 'objektbeschreibung', 'lage', 'sonstige_angaben')
		: '';
	return {
		title: title || 'Immobilie',
		description: desc,
	};
}

function pickFlaechen(immobilie: Element): { wohn: number | null; rooms: number | null } {
	const fl = immobilie.getElementsByTagName('flaechen')[0];
	if (!fl) return { wohn: null, rooms: null };
	const wohn = text(fl.getElementsByTagName('wohnflaeche')[0]);
	const nutz = text(fl.getElementsByTagName('nutzflaeche')[0]);
	const zimmer = text(fl.getElementsByTagName('anzahl_zimmer')[0]);
	return {
		wohn: parseNum(wohn) ?? parseNum(nutz),
		rooms: parseNum(zimmer),
	};
}

function pickObjektart(immobilie: Element): string {
	const oa = immobilie.getElementsByTagName('objektart')[0];
	if (!oa) return 'Immobilie';
	const nutz = oa.getElementsByTagName('nutzungsart')[0];
	if (nutz) return text(nutz) || 'Immobilie';
	const kind = Array.from(oa.children).find((c) => c.tagName.toLowerCase() !== 'nutzungsart');
	return kind ? `${kind.tagName.replace(/_/g, ' ')}` : 'Immobilie';
}

function externalIdFrom(immobilie: Element): string | undefined {
	const vt = immobilie.getElementsByTagName('verwaltung_techn')[0];
	if (vt) {
		const intern = text(vt.getElementsByTagName('objektnr_intern')[0]);
		if (intern) return intern;
		const extern = text(vt.getElementsByTagName('objektnr_extern')[0]);
		if (extern) return extern;
	}
	const idAttr = immobilie.getAttribute('id');
	if (idAttr) return idAttr;
	return undefined;
}

/** Parst typische OpenImmo-Exporte (ein oder mehrere Immobilien). */
export function parseOpenImmoXml(xmlString: string): ListingInput[] {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlString, 'text/xml');
	const parseError = doc.querySelector('parsererror');
	if (parseError) {
		throw new Error('XML konnte nicht gelesen werden.');
	}

	const results: ListingInput[] = [];
	const immobilien = doc.getElementsByTagName('immobilie');
	for (let i = 0; i < immobilien.length; i++) {
		const imm = immobilien[i]!;
		const geo = pickGeo(imm);
		const { title, description } = pickTitleDesc(imm);
		const { wohn, rooms } = pickFlaechen(imm);
		const images = collectImageUrls(imm);
		const extId = externalIdFrom(imm);
		const { priceEuro, pricePerMonthEuro, listingType } = pickPricing(imm);

		results.push(
			withListingBrowseIndex({
				title,
				description,
				priceEuro,
				pricePerMonthEuro: pricePerMonthEuro ?? undefined,
				livingSpaceSqm: wohn,
				rooms,
				propertyType: pickObjektart(imm),
				city: geo.city,
				zip: geo.zip,
				street: geo.street,
				images,
				source: 'xml',
				externalId: extId,
				...(listingType ? { listingType } : {}),
			} as Record<string, unknown>) as ListingInput,
		);
	}

	return results;
}
