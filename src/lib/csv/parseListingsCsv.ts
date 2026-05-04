import type { ListingInput, ListingSource } from '../types';
import { withListingBrowseIndex } from '../listingBrowseIndex';

export type CsvListingRow = ListingInput & {
	/** Wenn gesetzt: wie Adriom‑Import (`merge` nach dieser Dokument-ID). */
	firestoreDocumentId?: string;
};

/** Zeile parsen (Anführungszeichen, gedoppeltes `"` = Escape). Keine mehrzeiligen Zellen ohne schließende Anführungszeichen. */
function splitCsvCells(line: string): string[] {
	const out: string[] = [];
	let i = 0;
	let cell = '';
	let inQ = false;
	while (i < line.length) {
		const c = line[i]!;
		if (inQ) {
			if (c === '"') {
				const next = line[i + 1];
				if (next === '"') {
					cell += '"';
					i += 2;
					continue;
				}
				inQ = false;
				i++;
				continue;
			}
			cell += c;
			i++;
			continue;
		}
		if (c === ',') {
			out.push(cell);
			cell = '';
			i++;
			continue;
		}
		if (c === '"') {
			inQ = true;
			i++;
			continue;
		}
		cell += c;
		i++;
	}
	out.push(cell);
	return out;
}

function parseNum(raw: string): number | null {
	const t = raw.trim().replace(',', '.');
	if (!t) return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string): boolean {
	const t = raw.trim().toLowerCase();
	return t === 'true' || t === '1' || t === 'yes' || t === 'ja';
}

function normalizeHeader(h: string): string {
	return h.trim().toLowerCase();
}

/**
 * Bekannte Kopfnamen aus dem Repo‑Export sowie übliche Synonyme.
 * Kein Drag‑&‑Drop‑Mapper wie in WP All Import — stattdessen feste Zuordnung.
 */
const FIELD_ALIASES: Record<string, keyof ListingInput | '_skip'> = {
	id: '_skip',
	title: 'title',
	description: 'description',
	preis: 'priceEuro',
	price: 'priceEuro',
	priceeuro: 'priceEuro',
	preispromonat: 'pricePerMonthEuro',
	pricepermonth: 'pricePerMonthEuro',
	pricepermontheuro: 'pricePerMonthEuro',
	miete: 'pricePerMonthEuro',
	currency: 'currency',
	flaeche: 'livingSpaceSqm',
	wohnflaeche: 'livingSpaceSqm',
	livingspacesqm: 'livingSpaceSqm',
	zimmer: 'rooms',
	rooms: 'rooms',
	schlafzimmer: 'bedrooms',
	bedrooms: 'bedrooms',
	badezimmer: 'bathrooms',
	bathrooms: 'bathrooms',
	objekttyp: 'propertyType',
	propertytype: 'propertyType',
	stadt: 'city',
	city: 'city',
	plz: 'zip',
	zip: 'zip',
	strasse: 'street',
	street: 'street',
	land: 'country',
	country: 'country',
	latitude: 'latitude',
	longitude: 'longitude',
	breitengrad: 'latitude',
	längengrad: 'longitude',
	laengengrad: 'longitude',
	quelle: 'source',
	source: 'source',
	externalid: 'externalId',
	externeid: 'externalId',
	featured: 'featured',
	hervorgehoben: 'featured',
	listingurl: 'listingUrl',
	url: 'listingUrl',
	link: 'listingUrl',
	listingtype: 'listingType',
	pricepersqm: 'pricePerSqmEuro',
	preisprm2: 'pricePerSqmEuro',
	preis_prom2: 'pricePerSqmEuro',
	images: 'images',
	bilder: 'images',
	bildurls: 'images',
	features: 'features',
	ausstattung: 'features',
};

export type ParseListingsCsvOptions = {
	/**
	 * Wenn die Spalte `id` die Firestore‑Dokument‑ID enthält (= Export aus diesem Backend),
	 * können Einträge per `merge` aktualisiert werden (wie „Unique Identifier“ pro Datensatz).
	 */
	docIdColumn: 'none' | 'id';
};

const DEFAULT_SOURCE_FOR_CSV: ListingSource = 'xml';

/**
 * Roh‑CSV‑Text aus Excel/Google Sheets („Import any CSV“, kein WordPress nötig).
 */
export function parseListingsCsv(text: string, opts: ParseListingsCsvOptions): CsvListingRow[] {
	const lines = text.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
	const nonEmpty = lines.filter((l) => l.trim().length > 0);
	if (nonEmpty.length < 2) return [];

	const headers = splitCsvCells(nonEmpty[0]!).map(normalizeHeader);
	const colIndexByField = new Map<keyof ListingInput | '_skip', number>();
	const idColumnIndex = headers.findIndex((h) => h === 'id');
	for (let c = 0; c < headers.length; c++) {
		const key = FIELD_ALIASES[headers[c]!];
		if (!key || key === '_skip') continue;
		colIndexByField.set(key, c);
	}

	function cell(rowCells: string[], field: keyof ListingInput): string {
		const ix = colIndexByField.get(field);
		return ix !== undefined ? (rowCells[ix]?.trim() ?? '') : '';
	}

	const out: CsvListingRow[] = [];
	for (let r = 1; r < nonEmpty.length; r++) {
		const rowCells = splitCsvCells(nonEmpty[r]!);

		let firestoreDocumentId = '';
		if (opts.docIdColumn === 'id' && idColumnIndex >= 0) {
			firestoreDocumentId = (rowCells[idColumnIndex] ?? '').trim();
		}

		const imgsRaw = cell(rowCells, 'images');
		const images = imgsRaw
			? imgsRaw.split(/[|;\n]/).map((s) => s.trim()).filter(Boolean)
			: [];
		const featRaw = cell(rowCells, 'features');
		const features = featRaw
			? featRaw.split(/[|;\n]/).map((s) => s.trim()).filter(Boolean)
			: [];

		let sourceRaw = cell(rowCells, 'source').toLowerCase() as ListingSource | '';
		const allowed: ListingSource[] = ['manual', 'adriom', 'xml'];
		const source = allowed.includes(sourceRaw as ListingSource) ? (sourceRaw as ListingSource) : DEFAULT_SOURCE_FOR_CSV;

		const title = cell(rowCells, 'title') || 'Ohne Titel';
		const priceEuroRaw = parseNum(cell(rowCells, 'priceEuro'));
		const pricePerMonthRaw = parseNum(cell(rowCells, 'pricePerMonthEuro'));
		const latitude = parseNum(cell(rowCells, 'latitude'));
		const longitude = parseNum(cell(rowCells, 'longitude'));

		const row: CsvListingRow = {
			title,
			description: cell(rowCells, 'description'),
			priceEuro: priceEuroRaw,
			pricePerMonthEuro: pricePerMonthRaw ?? undefined,
			livingSpaceSqm: parseNum(cell(rowCells, 'livingSpaceSqm')),
			rooms: parseNum(cell(rowCells, 'rooms')),
			bedrooms: parseNum(cell(rowCells, 'bedrooms')),
			bathrooms: parseNum(cell(rowCells, 'bathrooms')),
			propertyType: cell(rowCells, 'propertyType') || 'Immobilie',
			city: cell(rowCells, 'city'),
			zip: cell(rowCells, 'zip'),
			street: cell(rowCells, 'street'),
			country: cell(rowCells, 'country') || undefined,
			images,
			source,
			externalId: cell(rowCells, 'externalId') || undefined,
			featured: parseBool(cell(rowCells, 'featured')),
			listingUrl: cell(rowCells, 'listingUrl') || undefined,
			listingType: cell(rowCells, 'listingType') || undefined,
			pricePerSqmEuro: parseNum(cell(rowCells, 'pricePerSqmEuro')),
			currency: cell(rowCells, 'currency') || 'EUR',
			latitude: latitude != null && Number.isFinite(latitude) ? latitude : null,
			longitude: longitude != null && Number.isFinite(longitude) ? longitude : null,
			...(features.length ? { features } : {}),
		};

		if (firestoreDocumentId) row.firestoreDocumentId = firestoreDocumentId;

		out.push(withListingBrowseIndex(row as unknown as Record<string, unknown>) as CsvListingRow);
	}

	return out;
}
