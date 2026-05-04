import { detectXmlRootTag } from '../xml/parseAdriom';

/**
 * Erkennt das Importformat (wie „Datei auswählen“ in WP All Import: XML vs. CSV/Tabellarisch).
 */
export function detectImportFormat(raw: string): 'listings' | 'openimmo' | 'csv' | 'unknown' {
	const text = raw.replace(/^\uFEFF/, '').trim();
	if (!text) return 'unknown';
	if (text.startsWith('<')) {
		const x = detectXmlRootTag(text);
		if (x === 'listings') return 'listings';
		if (x === 'openimmo') return 'openimmo';
		return 'unknown';
	}
	const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
	if (first.includes(',') && !first.trimStart().startsWith('<')) return 'csv';
	return 'unknown';
}
