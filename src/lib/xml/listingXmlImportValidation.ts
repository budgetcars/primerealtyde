import type { ListingInput } from '../types';

function imageUrlIssues(urls: readonly string[]): { errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];
	urls.forEach((u, i) => {
		const t = u.trim();
		if (!t) {
			errors.push(`Bildposition ${i + 1}: leere URL`);
			return;
		}
		const hasHttpScheme = /^https?:\/\//i.test(t);
		try {
			const parsed = new URL(t);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
				errors.push(`Bildposition ${i + 1}: nur http/https-URLs sind zulässig`);
			if (!parsed.hostname) warnings.push(`Bildposition ${i + 1}: Hostname fehlt`);
		} catch {
			if (hasHttpScheme) errors.push(`Bildposition ${i + 1}: ungültige URL`);
			else warnings.push(`Bildposition ${i + 1}: kein vollständiger http(s)-Link (ggf. relativer Pfad).`);
		}
	});
	return { errors, warnings };
}

/** Firestore-Dokument-IDs ohne „/“, begrenzte Länge (konservative Prüfung). */
export function validateFirestoreListingDocId(raw: string | undefined): string | null {
	if (raw == null) return 'Dokument-ID fehlt.';
	const id = raw.trim();
	if (!id) return 'Dokument-ID ist leer.';
	if (id.includes('/')) return 'Ungültige Dokument-ID (enthält „/“).';
	if (id.length > 768) return 'Dokument-ID überschreitet die maximal sinnvolle Länge.';
	if (id === '..') return 'Ungültige Dokument-ID.';
	return null;
}

export type ListingXmlImportCheck = {
	errors: string[];
	warnings: string[];
};

/**
 * Prüfungen vor dem Übernehmen aus Adriom-/OpenImmo-XML.
 * `errors` blockieren Standard-Import im UI; `warnings` sind Hinweise ohne Blockade.
 */
export function validateListingXmlImport(
	li: ListingInput,
	ctx: { kind: 'adriom'; docId: string } | { kind: 'openimmo'; rowIndex: number },
): ListingXmlImportCheck {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (ctx.kind === 'adriom') {
		const msg = validateFirestoreListingDocId(ctx.docId);
		if (msg) errors.push(msg);
	}

	const title = li.title?.trim() ?? '';
	if (!title) errors.push('Titel ist leer.');
	else if (title === 'Immobilie') warnings.push('Titel ist nur Platzhalter „Immobilie“.');

	const city = li.city?.trim() ?? '';
	if (!city) warnings.push('Ort ist leer.');

	const zip = li.zip?.trim() ?? '';
	if (!zip && ctx.kind === 'openimmo') warnings.push('PLZ ist leer (OpenImmo).');

	const street = li.street?.trim() ?? '';
	if (!street && ctx.kind === 'openimmo') warnings.push('Straße ist leer (OpenImmo).');

	const desc = li.description?.trim() ?? '';
	if (!desc) warnings.push('Beschreibung ist leer.');

	const hasPurchase = li.priceEuro != null && Number.isFinite(li.priceEuro) && li.priceEuro > 0;
	const hasMonthly = li.pricePerMonthEuro != null && Number.isFinite(li.pricePerMonthEuro) && li.pricePerMonthEuro > 0;

	if (li.priceEuro != null) {
		if (li.priceEuro < 0) errors.push('Kaufpreis darf nicht negativ sein.');
		if (!Number.isFinite(li.priceEuro)) errors.push('Kaufpreis ist kein gültiger Zahlenwert.');
	}
	if (li.pricePerMonthEuro != null) {
		if (li.pricePerMonthEuro < 0) errors.push('Monatsmiete darf nicht negativ sein.');
		if (!Number.isFinite(li.pricePerMonthEuro)) errors.push('Monatsmiete ist kein gültiger Zahlenwert.');
	}
	if (!hasPurchase && !hasMonthly) {
		warnings.push('Weder Kaufpreis noch Monatsmiete gesetzt („auf Anfrage“ möglich).');
	}

	const imgs = Array.isArray(li.images) ? li.images : [];
	if (imgs.length === 0) warnings.push('Es sind keine Bild-URLs angegeben.');
	const imgProblems = imageUrlIssues(imgs);
	errors.push(...imgProblems.errors);
	warnings.push(...imgProblems.warnings);

	const hasLat = li.latitude != null && Number.isFinite(li.latitude);
	const hasLon = li.longitude != null && Number.isFinite(li.longitude);
	if (hasLat !== hasLon) warnings.push('Nur eines von geo-Breitengrad/geo-Längengrad gesetzt.');
	if (hasLat && li.latitude != null && (li.latitude < -90 || li.latitude > 90))
		errors.push('Breitengrad außerhalb des gültigen Bereiches (-90…90).');
	if (hasLon && li.longitude != null && (li.longitude < -180 || li.longitude > 180))
		errors.push('Längengrad außerhalb des gültigen Bereiches (-180…180).');

	return { errors, warnings };
}

export function stableOpenImmoStagingKey(idx: number, li: ListingInput): string {
	const ext = li.externalId?.trim() ?? '';
	const t = li.title.trim().slice(0, 32).replace(/\s+/g, '-');
	return `openimmo-${idx}-${ext || 'noid'}-${t || 'immobilie'}`;
}
