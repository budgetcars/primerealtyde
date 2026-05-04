import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Lädt eine Feed-URL serverseitig (ohne Browser-CORS).
 * Nur für angemeldete Nutzer — verhindert Missbrauch als offener Proxy.
 */
export const fetchXmlFeedProxy = onCall(
	{
		region: 'europe-west1',
		timeoutSeconds: 120,
		memory: '512MiB',
		maxInstances: 5,
	},
	async (request) => {
		if (!request.auth) {
			throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
		}

		const raw = request.data?.url;
		if (typeof raw !== 'string') {
			throw new HttpsError('invalid-argument', 'Parameter „url“ fehlt oder ist ungültig.');
		}
		const url = raw.trim();
		if (!url) {
			throw new HttpsError('invalid-argument', 'URL ist leer.');
		}

		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			throw new HttpsError('invalid-argument', 'URL konnte nicht geparst werden.');
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new HttpsError('invalid-argument', 'Nur http(s)-URLs sind erlaubt.');
		}

		let res: Response;
		try {
			res = await fetch(url, {
				redirect: 'follow',
				headers: {
					'User-Agent': 'PrimeRealty-AdminImport/1.0 (+https://prime-realty.de)',
					Accept: 'application/xml,text/xml,text/plain,*/*;q=0.8',
				},
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			logger.warn('fetchXmlFeedProxy fetch failed', { url: parsed.origin, msg });
			throw new HttpsError('unavailable', `Abruf fehlgeschlagen: ${msg}`);
		}

		if (!res.ok) {
			throw new HttpsError('failed-precondition', `Remote-Server: HTTP ${res.status}`);
		}

		const buf = await res.arrayBuffer();
		if (buf.byteLength > MAX_BYTES) {
			throw new HttpsError(
				'failed-precondition',
				`Antwort zu groß (${buf.byteLength} Bytes, Maximum ${MAX_BYTES}). Bitte Datei-Upload nutzen.`,
			);
		}

		const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
		return { body: text, bytes: buf.byteLength };
	},
);
