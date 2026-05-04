import type { Firestore } from 'firebase/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';

const CHUNK = 30;

/**
 * Für „Update bestehender Datensätze nach eindeutiger Fremd-ID“ (wie WP All Import „Unique Identifier“ / manuelles Matching).
 */
export async function mapExternalIdsToFirestoreDocIds(
	db: Firestore,
	collectionName: string,
	externalIds: readonly string[],
): Promise<Map<string, string>> {
	const unique = [...new Set(externalIds.map((x) => x.trim()).filter(Boolean))];
	const map = new Map<string, string>();
	for (let i = 0; i < unique.length; i += CHUNK) {
		const slice = unique.slice(i, i + CHUNK);
		const snap = await getDocs(query(collection(db, collectionName), where('externalId', 'in', slice)));
		snap.forEach((d) => {
			const ex = String((d.data() as { externalId?: string }).externalId ?? '').trim();
			if (ex && !map.has(ex)) map.set(ex, d.id);
		});
	}
	return map;
}
