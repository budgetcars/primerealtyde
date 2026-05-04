import type { Listing } from '../types';

function escapeXml(raw: string): string {
	return raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Ein Text-Child nur ausgeben, wenn sinnvoll (nicht leer oder null). */
function el(name: string, content: string | number | null | undefined): string {
	if (content == null || content === '') return '';
	const t = String(content);
	return `<${name}>${escapeXml(t)}</${name}>`;
}

function optionalBlock(name: string, inner: string): string {
	const t = inner.trim();
	if (!t) return '';
	return `<${name}>${t}</${name}>`;
}

/**
 * Wendet einfache Export-Filter an (analog zu Export-Regeln in WP All Export „nur bestimmte Datensätze“).
 */
export type ListingExportFilter =
	| { kind: 'all' }
	| { kind: 'featured' }
	| { kind: 'source'; value: Listing['source'] }
	| { kind: 'countryContains'; needle: string };

export function listingMatchesExportFilter(row: Listing, filter: ListingExportFilter): boolean {
	switch (filter.kind) {
		case 'all':
			return true;
		case 'featured':
			return Boolean(row.featured);
		case 'source':
			return row.source === filter.value;
		case 'countryContains': {
			const c = row.country?.trim().toLowerCase() ?? '';
			return c.includes(filter.needle.trim().toLowerCase());
		}
		default:
			return true;
	}
}

/** Eine Zeile als Adriom-kompatibles `<listing>` (passt zu `parseAdriomXml`). */
export function listingToAdriomListingXml(row: Listing, titleLang: string = 'de'): string {
	const id = row.id?.trim();
	if (!id) return '';

	const titleText = (row.title ?? '').trim();
	const titles = titleText
		? `<titles><title lang="${escapeXml(titleLang)}">${escapeXml(titleText)}</title></titles>`
		: '<titles></titles>';
	const desc = row.description ?? '';
	const descriptions = desc
		? `<descriptions><description lang="${escapeXml(titleLang)}">${escapeXml(desc)}</description></descriptions>`
		: '<descriptions></descriptions>';

	const imgs = (row.images ?? [])
		.map((u, i) => {
			const url = u.trim();
			if (!url) return '';
			return `<image position="${i}">${escapeXml(url)}</image>`;
		})
		.filter(Boolean)
		.join('');
	const imagesBlock = imgs ? `<images>${imgs}</images>` : '<images></images>';

	const feats = (row.features ?? [])
		.map((f) => el('feature', f))
		.filter((s) => s.length > 0)
		.join('');
	const featuresBlock = feats ? `<features>${feats}</features>` : '';

	const specInner = [
		row.bedrooms != null ? el('bedrooms', row.bedrooms) : '',
		row.bathrooms != null ? el('bathrooms', row.bathrooms) : '',
		row.livingSpaceSqm != null ? el('area', row.livingSpaceSqm) : '',
	].join('');
	const specifications = optionalBlock('specifications', specInner);

	let coordinates = '';
	if (row.latitude != null && row.longitude != null) {
		coordinates = `<coordinates>${el('latitude', row.latitude)}${el('longitude', row.longitude)}</coordinates>`;
	}

	const datesInner = [el('created', row.remoteCreatedAt), el('updated', row.remoteUpdatedAt)].join('');
	const dates = optionalBlock('dates', datesInner);

	const priceAttr = row.currency ? ` currency="${escapeXml(row.currency)}"` : ' currency="EUR"';
	const priceTag =
		row.priceEuro != null ? `<price${priceAttr}>${escapeXml(String(row.priceEuro))}</price>` : '';
	const pricePerMonthTag =
		row.pricePerMonthEuro != null && Number.isFinite(row.pricePerMonthEuro)
			? el('pricePerMonth', row.pricePerMonthEuro)
			: '';

	return `<listing id="${escapeXml(id)}">
${row.listingUrl ? el('url', row.listingUrl) : ''}
${row.listingType ? el('listingType', row.listingType) : ''}
${el('propertyType', row.propertyType || 'Immobilie')}
${el('featured', row.featured ? 'true' : 'false')}
${row.country ? el('country', row.country) : ''}
${row.city ? el('city', row.city) : ''}
${row.zip ? el('zip', row.zip) : ''}
${row.street ? el('street', row.street) : ''}
${priceTag}
${pricePerMonthTag}
${row.pricePerSqmEuro != null ? el('pricePerSqm', row.pricePerSqmEuro) : ''}
${specifications}
${coordinates}
${dates}
${titles}
${descriptions}
${imagesBlock}
${featuresBlock}
</listing>`;
}

export type ExportAdriomXmlOptions = {
	/** Root-Attribute wie im eingelesenen Feed */
	feedSource?: string;
	feedSourceUrl?: string;
	titleLang?: string;
};

/**
 * Vollständiges `<listings>`-Dokument — kann nach Bearbeitung wieder importiert werden (Import-Dialog im Admin).
 * `rows` idealerweise vorher gefiltert (z. B. WP‑All‑Export‑artige Auswahl).
 */
export function exportListingsToAdriomListingsXml(rows: Listing[], opts: ExportAdriomXmlOptions = {}): string {
	const titleLang = opts.titleLang ?? 'de';
	const inner = rows.map((r) => listingToAdriomListingXml(r, titleLang)).filter(Boolean).join('\n');

	const now = new Date().toISOString();
	const attrs = [
		opts.feedSource ? `source="${escapeXml(opts.feedSource)}"` : '',
		opts.feedSourceUrl ? `sourceUrl="${escapeXml(opts.feedSourceUrl)}"` : '',
		`generated="${escapeXml(now)}"`,
		`count="${rows.length}"`,
	]
		.filter(Boolean)
		.join(' ');

	return `<?xml version="1.0" encoding="UTF-8"?>
<listings ${attrs}>
${inner}
</listings>`;
}

const CSV_COLUMNS: (keyof Listing | 'id')[] = [
	'id',
	'title',
	'description',
	'priceEuro',
	'pricePerMonthEuro',
	'currency',
	'livingSpaceSqm',
	'rooms',
	'bedrooms',
	'bathrooms',
	'propertyType',
	'city',
	'zip',
	'street',
	'country',
	'latitude',
	'longitude',
	'source',
	'externalId',
	'featured',
	'listingUrl',
	'listingType',
	'pricePerSqmEuro',
	'images',
	'features',
];

function escapeCsvCell(v: string): string {
	if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
	return v;
}

/** Flache Tabelle (Excel-tauglich) — `rows` vorher wie gewünscht filtern. */
export function exportListingsToCsv(rows: Listing[]): string {
	const header = CSV_COLUMNS.join(',');
	const lines = rows.map((row) => {
		const cells = CSV_COLUMNS.map((key) => {
			if (key === 'id') return escapeCsvCell(row.id ?? '');
			const v = row[key as keyof Listing];
			if (v == null) return '';
			if (Array.isArray(v)) return escapeCsvCell(v.join('|'));
			if (typeof v === 'boolean') return v ? 'true' : 'false';
			if (typeof v === 'object') return escapeCsvCell(JSON.stringify(v));
			return escapeCsvCell(String(v));
		});
		return cells.join(',');
	});
	return [header, ...lines].join('\r\n');
}
