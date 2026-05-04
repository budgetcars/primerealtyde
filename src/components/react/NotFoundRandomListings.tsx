import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { withLocalePath } from '../../i18n/locale';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { ListingCard } from './ListingCard';

function sampleRandom<T>(arr: T[], max: number): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = copy[i]!;
		copy[i] = copy[j]!;
		copy[j] = tmp;
	}
	return copy.slice(0, max);
}

export function NotFoundRandomListings({
	locale,
	limit = 6,
}: {
	locale: Locale;
	limit?: number;
}) {
	const [skipped] = useState(() => !isFirebaseConfigured());
	const [items, setItems] = useState<Listing[]>([]);
	const [loading, setLoading] = useState(() => !skipped);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		if (skipped) return;
		getDocs(collection(getDb(), 'listings'))
			.then((snap) => {
				const list: Listing[] = [];
				snap.forEach((d) => {
					list.push({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) });
				});
				setItems(sampleRandom(list, limit));
			})
			.catch((e: Error) => setErr(e.message))
			.finally(() => setLoading(false));
	}, [limit, skipped]);

	const listingsPath = withLocalePath('/immobilien', locale);
	const detailPath = withLocalePath('/immobilie', locale);

	if (skipped || loading || err || !items.length) {
		return (
			<p className="text-sm text-slate-600">
				<a href={listingsPath} className="font-semibold text-amber-900 underline decoration-amber-300 hover:decoration-amber-500">
					Zu allen Immobilien
				</a>
			</p>
		);
	}

	return (
		<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{items.map((item) => (
				<ListingCard key={item.id} item={item} locale={locale} detailBasePath={detailPath} />
			))}
		</div>
	);
}
