/** Generisches XML → ListingInput über Pfad-Templates wie {{town}} oder {{picture[0]/url}} */

import type { ListingInput } from '../types';
import { withListingBrowseIndex } from '../listingBrowseIndex';

export type XmlTagCount = { name: string; count: number };

export type XmlPathSample = { path: string; sample: string };

/** Bearbeitbare Vorlagenfelder für einen Datensatz */
export type GenericXmlFieldMapping = {
	title: string;
	description: string;
	priceEuro: string;
	city: string;
	zip: string;
	street: string;
	country: string;
	propertyType: string;
	rooms: string;
	livingSpaceSqm: string;
	bedrooms: string;
	bathrooms: string;
	images: string;
	externalId: string;
	featured: string;
	latitude: string;
	longitude: string;
	listingUrl: string;
};

export function defaultGenericXmlFieldMapping(): GenericXmlFieldMapping {
	return {
		title: '',
		description: '',
		priceEuro: '',
		city: '',
		zip: '',
		street: '',
		country: '',
		propertyType: 'Ferienwohnung',
		rooms: '',
		livingSpaceSqm: '',
		bedrooms: '',
		bathrooms: '',
		images: '',
		externalId: '',
		featured: '',
		latitude: '',
		longitude: '',
		listingUrl: '',
	};
}

export function parseGenericXmlDocument(xmlString: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlString.replace(/^\uFEFF/, ''), 'text/xml');
	const err = doc.querySelector('parsererror');
	if (err) throw new Error('XML konnte nicht gelesen werden.');
	const root = doc.documentElement;
	if (!root) throw new Error('Leeres XML.');
	return doc;
}

function elemTagKey(el: Element): string {
	return el.tagName;
}

/** Häufigkeiten aller Element-Knoten (wie WP „Review Import File“). */
export function collectXmlTagCounts(doc: Document): XmlTagCount[] {
	const counts = new Map<string, number>();
	function walk(el: Element) {
		const k = elemTagKey(el);
		counts.set(k, (counts.get(k) ?? 0) + 1);
		for (const ch of el.children) walk(ch);
	}
	walk(doc.documentElement);
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)));
}

/** Alle Elemente dieses Tags (über das gesamte Dokument — wie WP: Nutzer wählt den sich wiederholenden Knoten). */
export function listRecordElements(doc: Document, tagName: string): Element[] {
	const list = doc.getElementsByTagName(tagName);
	return [...list];
}

function directTextTrimmed(el: Element): string {
	return [...el.childNodes]
		.filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE)
		.map((n) => (n.textContent ?? '').trim())
		.filter(Boolean)
		.join(' ')
		.trim();
}

/**
 * Pfade relativ zum gewählten Datensatz-Knoten (ohne Präfix mit dem Wurzel-Tagnamen).
 * Geschwister gleichen Namens werden als `tag[0]`, `tag[1]` … unterschieden.
 */
export function collectRelativePathsFromRecord(record: Element): XmlPathSample[] {
	const out: XmlPathSample[] = [];
	const seen = new Set<string>();

	function push(path: string, sample: string) {
		if (!path || seen.has(path)) return;
		seen.add(path);
		out.push({ path, sample: sample.slice(0, 200) });
	}

	for (let i = 0; i < record.attributes.length; i++) {
		const a = record.attributes[i]!;
		push(`@${a.name}`, (a.value ?? '').trim());
	}

	function walk(el: Element, segments: string[]) {
		const kids = [...el.children];
		const hasChildElements = kids.length > 0;

		if (!hasChildElements) {
			const text = directTextTrimmed(el);
			push(segments.join('/'), text);
			return;
		}

		const byTag = new Map<string, Element[]>();
		for (const ch of kids) {
			const t = elemTagKey(ch);
			const arr = byTag.get(t);
			if (arr) arr.push(ch);
			else byTag.set(t, [ch]);
		}

		for (const ch of kids) {
			const t = elemTagKey(ch);
			const siblings = byTag.get(t)!;
			let seg: string;
			if (siblings.length === 1) seg = t;
			else {
				const idx = siblings.indexOf(ch);
				seg = `${t}[${idx}]`;
			}
			for (let a = 0; a < ch.attributes.length; a++) {
				const att = ch.attributes[a]!;
				const p = [...segments, seg, `@${att.name}`].join('/');
				push(p, (att.value ?? '').trim());
			}
			walk(ch, [...segments, seg]);
		}
	}

	for (const ch of record.children) {
		const t = elemTagKey(ch);
		const same = [...record.children].filter((c) => elemTagKey(c) === t);
		const seg = same.length === 1 ? t : `${t}[${same.indexOf(ch)}]`;
		for (let a = 0; a < ch.attributes.length; a++) {
			const att = ch.attributes[a]!;
			push([seg, `@${att.name}`].join('/'), (att.value ?? '').trim());
		}
		walk(ch, [seg]);
	}

	out.sort((x, y) => x.path.localeCompare(y.path));
	return out;
}

function getByPath(root: Element, path: string): string {
	const all = getAllByPath(root, path);
	return all[0] ?? '';
}

function getAllByPath(root: Element, path: string): string[] {
	if (!path) return [];
	const trimmed = path.trim();
	if (!trimmed) return [];
	if (trimmed.startsWith('@')) {
		const v = root.getAttribute(trimmed.slice(1))?.trim();
		return v ? [v] : [];
	}

	const segments = trimmed.split('/').filter(Boolean);
	let frontier: Element[] = [root];

	for (const seg of segments) {
		if (!frontier.length) return [];
		if (seg.startsWith('@')) {
			const vals = frontier
				.map((el) => el.getAttribute(seg.slice(1))?.trim() ?? '')
				.filter(Boolean);
			return vals;
		}
		const bm = /^([^[]+)(?:\[(\d+)\])?$/.exec(seg);
		const wm = /^([^[]+)\[\*\]$/.exec(seg);
		if (wm) {
			const tag = wm[1]!;
			const next: Element[] = [];
			for (const base of frontier) {
				const candidates = [...base.children].filter((c) => elemTagKey(c) === tag);
				next.push(...candidates);
			}
			frontier = next;
			continue;
		}
		if (!bm) return [];
		const tag = bm[1]!;
		const idx = bm[2] != null ? parseInt(bm[2]!, 10) : 0;
		const next: Element[] = [];
		for (const base of frontier) {
			const candidates = [...base.children].filter((c) => elemTagKey(c) === tag);
			if (candidates[idx]) next.push(candidates[idx]!);
		}
		frontier = next;
	}

	const vals = frontier.map((el) => directTextTrimmed(el)).filter(Boolean);
	return vals;
}

/** Wert aller `{{pfad}}`-Platzhalter ersetzen (relativ zu einem Datensatz-Element). */
export function expandMappingTemplate(root: Element, template: string): string {
	if (!template.trim()) return '';
	return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, rawPath: string) => {
		const p = String(rawPath).trim();
		return getByPath(root, p);
	});
}

export function parseFlexibleNumber(raw: string): number | null {
	const s = raw.trim();
	if (!s) return null;
	const cleaned = s.replace(/[£€$\s]/gi, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
	const n = parseFloat(cleaned);
	return Number.isFinite(n) ? n : null;
}

export function parseFlexibleInt(raw: string): number | null {
	const n = parseFlexibleNumber(raw);
	if (n == null) return null;
	const r = Math.round(n);
	return Number.isFinite(r) ? r : null;
}

export function parseFeaturedFlag(raw: string): boolean | undefined {
	const t = raw.trim().toLowerCase();
	if (!t) return undefined;
	if (['1', 'true', 'yes', 'y', 'ja'].includes(t)) return true;
	if (['0', 'false', 'no', 'n', 'nein'].includes(t)) return false;
	return undefined;
}

export function listingInputFromMappedRecord(
	record: Element,
	mapping: GenericXmlFieldMapping,
	opts?: { fallbackTitle?: string },
): ListingInput {
	const ex = (t: string) => expandMappingTemplate(record, t).trim();

	let title = ex(mapping.title);
	if (!title) title = opts?.fallbackTitle?.trim() ?? '';
	if (!title) title = 'Immobilie';

	const desc = ex(mapping.description);
	const priceEuro = parseFlexibleNumber(ex(mapping.priceEuro));
	const rooms = parseFlexibleInt(ex(mapping.rooms));
	const livingSpaceSqm = parseFlexibleNumber(ex(mapping.livingSpaceSqm));
	const bedrooms = parseFlexibleInt(ex(mapping.bedrooms));
	const bathrooms = parseFlexibleInt(ex(mapping.bathrooms));
	const latitude = parseFlexibleNumber(ex(mapping.latitude));
	const longitude = parseFlexibleNumber(ex(mapping.longitude));

	const images = mapping.images
		.split(/\r?\n/)
		.flatMap((line) => {
			const trimmed = line.trim();
			if (!trimmed) return [];
			const pureToken = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(trimmed);
			if (pureToken) {
				return getAllByPath(record, pureToken[1]!)
					.map((v) => v.trim())
					.filter(Boolean);
			}
			return [expandMappingTemplate(record, trimmed).trim()].filter(Boolean);
		})
		.filter(Boolean);

	const featured = parseFeaturedFlag(ex(mapping.featured));

	const ext = ex(mapping.externalId);
	const propertyType = ex(mapping.propertyType) || 'Ferienwohnung';

	const li: ListingInput = {
		title,
		description: desc,
		priceEuro,
		livingSpaceSqm: livingSpaceSqm ?? null,
		rooms: rooms ?? null,
		propertyType,
		city: ex(mapping.city),
		zip: ex(mapping.zip),
		street: ex(mapping.street),
		images,
		source: 'xml',
		externalId: ext || undefined,
		country: ex(mapping.country) || undefined,
		bedrooms: bedrooms ?? undefined,
		bathrooms: bathrooms ?? undefined,
		latitude: latitude ?? undefined,
		longitude: longitude ?? undefined,
		listingUrl: ex(mapping.listingUrl) || undefined,
	};
	if (featured !== undefined) li.featured = featured;
	return withListingBrowseIndex(li as unknown as Record<string, unknown>) as ListingInput;
}

export function guessMappingFromPaths(paths: string[]): GenericXmlFieldMapping {
	const m = defaultGenericXmlFieldMapping();
	const normalized = paths.map((p) => ({ original: p, lower: p.toLowerCase() }));

	const matchCandidate = (pLower: string, candidateLower: string): boolean => {
		if (pLower === candidateLower) return true;
		if (pLower.endsWith(`/${candidateLower}`)) return true;
		if (pLower.endsWith(`/${candidateLower}[0]`)) return true;
		if (pLower.endsWith(`/${candidateLower}[1]`)) return true;
		if (candidateLower.startsWith('@') && pLower.endsWith(`/${candidateLower}`)) return true;
		return false;
	};

	const pick = (cands: string[]) => {
		for (const c of cands) {
			const lc = c.toLowerCase();
			for (const p of normalized) {
				if (matchCandidate(p.lower, lc)) return p.original;
			}
		}
		return null;
	};

	const t = pick([
		'advert_heading',
		'main_heading',
		'title',
		'name',
		'heading',
		'objecttitle',
		'ueberschrift',
	]);
	if (t) m.title = `{{${t}}}`;

	const desc = pick([
		'main_advert',
		'description',
		'body',
		'text',
		'expose',
		'objektbeschreibung',
		'freitext',
	]);
	if (desc) m.description = `{{${desc}}}`;

	const price = pick(['numeric_price', 'price', 'kaufpreis', 'kaufpreis_netto', 'price_value', 'precio']);
	if (price) m.priceEuro = `{{${price}}}`;
	else {
		const pt = pick(['price_text', 'preis', 'price_text_value']);
		if (pt) m.priceEuro = `{{${pt}}}`;
	}

	const city = pick(['town', 'city', 'ort', 'stadt', 'gemeinde']);
	if (city) m.city = `{{${city}}}`;

	const pc = pick(['postcode', 'zip', 'plz', 'postalcode']);
	if (pc) m.zip = `{{${pc}}}`;

	const street = pick(['street', 'strasse', 'str', 'address_line1', 'address1']);
	if (street) m.street = `{{${street}}}`;

	const country = pick(['country', 'land', 'state', 'region']);
	if (country) m.country = `{{${country}}}`;

	const rooms = pick(['bedrooms', 'zimmer', 'rooms', 'rooms_total', 'anzahl_zimmer']);
	if (rooms) m.rooms = `{{${rooms}}}`;

	const sqm = pick(['sqft', 'floorspace', 'wohnflaeche', 'living_space', 'surface', 'area']);
	if (sqm) m.livingSpaceSqm = `{{${sqm}}}`;

	const bd = pick(['bedrooms', 'schlafzimmer']);
	if (bd) m.bedrooms = `{{${bd}}}`;

	const ba = pick(['bathrooms', 'badezimmer']);
	if (ba) m.bathrooms = `{{${ba}}}`;

	const ext = pick([
		'@reference',
		'@id',
		'@ref',
		'@key',
		'reference',
		'id',
		'object_id',
		'objektnr',
		'external_id',
		'property_ref',
	]);
	if (ext) m.externalId = `{{${ext}}}`;

	const img = normalized.find((entry) => {
		const l = entry.lower;
		return (
			l.includes('picture') ||
			l.includes('image') ||
			l.includes('photo') ||
			l.endsWith('/url') ||
			l.endsWith('/href')
		);
	});
	if (img) {
		const wildcard = img.original.replace(/\[\d+\]/g, '[*]');
		m.images = `{{${wildcard}}}`;
	}

	const f = pick(['propertyofweek', 'featured', 'highlight']);
	if (f) m.featured = `{{${f}}}`;

	return m;
}
