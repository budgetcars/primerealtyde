import {
	collection,
	doc,
	type Firestore,
	getDocs,
	query,
	where,
	writeBatch,
} from 'firebase/firestore';

import type { Listing } from '../types';

/**
 * Löscht Dokumente mit source === 'xml', gesetzter externalId, die nicht in keepExternalIds vorkommen
 * (WP All Import: „Remove records no longer in file“).
 *
 * optional scopeSubstring: nur wenn xmlFeedSource oder xmlFeedSourceUrl diesen Teilstring enthalten.
 */
export async function deleteXmlListingsNotInExternalIdSet(
	db: Firestore,
	collectionName: string,
	keepExternalIds: ReadonlySet<string>,
	opts?: { scopeSubstring?: string },
): Promise<number> {
	if (keepExternalIds.size === 0) return 0;

	const q = query(collection(db, collectionName), where('source', '==', 'xml'));
	const snap = await getDocs(q);
	const scope = opts?.scopeSubstring?.trim().toLowerCase() ?? '';

	const toDelete: string[] = [];
	for (const d of snap.docs) {
		const data = d.data() as Partial<Listing>;
		const ext = typeof data.externalId === 'string' ? data.externalId.trim() : '';
		if (!ext || keepExternalIds.has(ext)) continue;

		if (scope) {
			const hay = `${data.xmlFeedSource ?? ''} ${data.xmlFeedSourceUrl ?? ''}`.toLowerCase();
			if (!hay.includes(scope)) continue;
		}

		toDelete.push(d.id);
	}

	const chunk = 450;
	for (let i = 0; i < toDelete.length; i += chunk) {
		const slice = toDelete.slice(i, i + chunk);
		const batch = writeBatch(db);
		for (const id of slice) {
			batch.delete(doc(db, collectionName, id));
		}
		await batch.commit();
	}

	return toDelete.length;
}
