import { useEffect, useState } from 'react';
import {
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	type QueryConstraint,
} from 'firebase/firestore';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { listingsUi } from '../../i18n/copy/listingsUi';
import { listingMatchesQuery } from '../../lib/listingsQuery';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { ListingCard } from './ListingCard';

export function ListingsGrid({
	limit: limitCount,
	initialSearch = '',
	locale = 'de',
	listingsListPath = '/immobilien',
	listingDetailBasePath = '/immobilie',
}: {
	limit?: number;
	/** GET-Parameter `q` für die Listing-Übersicht – clientseitige Textsuche */
	initialSearch?: string;
	locale?: Locale;
	listingsListPath?: string;
	listingDetailBasePath?: string;
}) {
	const L = listingsUi[locale];

	const [skipped] = useState(() => !isFirebaseConfigured());
	const [items, setItems] = useState<Listing[]>([]);
	const [loading, setLoading] = useState(() => !skipped);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		if (skipped) return;
		const db = getDb();
		const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
		if (limitCount != null) constraints.push(limit(limitCount));
		const q = query(collection(db, 'listings'), ...constraints);
		getDocs(q)
			.then((snap) => {
				const list: Listing[] = [];
				snap.forEach((d) => {
					const data = d.data() as Omit<Listing, 'id'>;
					list.push({ id: d.id, ...data });
				});
				setItems(list);
			})
			.catch((e: Error) => setErr(e.message))
			.finally(() => setLoading(false));
	}, [limitCount, skipped]);

	const effectiveQuery =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search).get('q')?.trim() ?? ''
			: (initialSearch ?? '').trim();

	const visible = effectiveQuery ? items.filter((it) => listingMatchesQuery(it, effectiveQuery)) : items;

	if (skipped) return null;
	if (loading)
		return (
			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((k) => (
					<div
						key={k}
						className="h-80 animate-pulse rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm"
					/>
				))}
			</div>
		);
	if (err)
		return (
			<p className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 backdrop-blur-sm">
				{err}
			</p>
		);
	if (!items.length)
		return (
			<p className="glass-panel-soft px-4 py-6 text-center text-sm text-slate-600">
				{L.noListingsIntro}{' '}
				<a
					href={listingsListPath.startsWith('/en') ? '/en/kontakt' : '/kontakt'}
					className="font-semibold text-amber-900 underline decoration-amber-400/70 hover:text-amber-950"
				>
					{L.noListingsInquiry}
				</a>
				.
			</p>
		);

	if (effectiveQuery && !visible.length)
		return (
			<p className="glass-panel-soft px-4 py-6 text-center text-sm text-slate-600">
				{L.noHits} „{effectiveQuery}“.{' '}
				<a href={listingsListPath} className="font-semibold text-amber-900 underline decoration-amber-400/70 hover:text-amber-950">
					{L.resetFilter}
				</a>
			</p>
		);

	return (
		<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{visible.map((item) => (
				<ListingCard key={item.id} item={item} locale={locale} detailBasePath={listingDetailBasePath} />
			))}
		</div>
	);
}
