import { useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import type { ListingBrowseFilters } from '../../lib/listingsQuery';
import { listingsUi } from '../../i18n/copy/listingsUi';
import {
	hasActiveListingBrowseFilters,
	listingMatchesBrowseFilters,
	sanitizeListingBrowseFilters,
} from '../../lib/listingsQuery';
import { withLocalePath } from '../../i18n/locale';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { ListingCard } from './ListingCard';
import { ListingsMap } from './ListingsMap';

function sortListingsByCreatedAt(list: Listing[]): Listing[] {
	return [...list].sort((a, b) => {
		const as = a.createdAt?.seconds ?? 0;
		const bs = b.createdAt?.seconds ?? 0;
		if (bs !== as) return bs - as;
		return (b.id ?? '').localeCompare(a.id ?? '');
	});
}

function filtersFromBrowser(): ListingBrowseFilters {
	return sanitizeListingBrowseFilters(new URLSearchParams(window.location.search));
}

export function ListingsBrowse({
	locale = 'de',
	listingsListPath = '/immobilien',
	listingDetailBasePath = '/immobilie',
}: {
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
		/** ohne orderBy — sonst werden Dokumente ohne `createdAt` oft gar nicht zurückgegeben */
		const qSnap = query(collection(db, 'listings'));
		getDocs(qSnap)
			.then((snap) => {
				const list: Listing[] = [];
				snap.forEach((d) => {
					const data = d.data() as Omit<Listing, 'id'>;
					list.push({ id: d.id, ...data });
				});
				setItems(sortListingsByCreatedAt(list));
				setErr(null);
			})
			.catch((e: Error) => setErr(e.message))
			.finally(() => setLoading(false));
	}, [skipped]);

	const effectiveFilters = filtersFromBrowser();
	const visible = items.filter((it) => listingMatchesBrowseFilters(it, effectiveFilters));
	const filtersActive = hasActiveListingBrowseFilters(effectiveFilters);
	const visibleWithCoords = visible.filter(
		(it) => it.latitude != null && it.longitude != null && !Number.isNaN(it.latitude) && !Number.isNaN(it.longitude),
	);

	const emptyCatalog = !skipped && !loading && !err && items.length === 0;
	const emptyFiltered = !skipped && !loading && !err && filtersActive && items.length > 0 && visible.length === 0;

	if (skipped) {
		return (
			<div className="space-y-6">
				<p className="rounded-xl border border-amber-200/85 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950 backdrop-blur-sm">
					{L.firebaseUnsetHint}
				</p>
				<div className="relative">
					<ListingsMap listings={[]} detailBasePath={listingDetailBasePath} locale={locale} />
				</div>
			</div>
		);
	}

	if (loading)
		return (
			<div className="space-y-10">
				<div className="h-[55vh] min-h-[360px] max-h-[640px] animate-pulse rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm" />
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map((k) => (
						<div
							key={k}
							className="h-80 animate-pulse rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm"
						/>
					))}
				</div>
			</div>
		);
	if (err)
		return (
			<p className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 backdrop-blur-sm">
				{err}
			</p>
		);

	return (
		<div className="space-y-10">
			<div className="relative">
				<ListingsMap listings={visible} detailBasePath={listingDetailBasePath} locale={locale} />
				{visible.length > 0 && visibleWithCoords.length === 0 ? (
					<p className="pointer-events-none absolute bottom-4 left-1/2 z-[2000] max-w-lg -translate-x-1/2 rounded-xl border border-amber-200/80 bg-white/95 px-4 py-2 text-center text-xs text-slate-600 shadow-lg backdrop-blur-sm md:text-sm">
						{L.mapNoCoordsHint}
					</p>
				) : null}
			</div>

			{emptyCatalog ? (
				<p className="glass-panel-soft px-4 py-6 text-center text-sm text-slate-600">
					{L.noListingsIntro}{' '}
					<a
						href={withLocalePath('/kontakt', locale)}
						className="font-semibold text-amber-900 underline decoration-amber-400/70 hover:text-amber-950"
					>
						{L.noListingsInquiry}
					</a>
					.
				</p>
			) : emptyFiltered ? (
				<p className="glass-panel-soft px-4 py-6 text-center text-sm text-slate-600">
					{effectiveFilters.q.trim() ? `${L.noHits} „${effectiveFilters.q.trim()}“. ` : `${L.noHitsFilters} `}
					<a href={listingsListPath} className="font-semibold text-amber-900 underline decoration-amber-400/70 hover:text-amber-950">
						{L.resetFilter}
					</a>
				</p>
			) : (
				<div>
					<h2 className="font-heading-display text-xl font-semibold tracking-tight text-gray-900 md:text-2xl">{L.listSectionTitle}</h2>
					<p className="mt-1 text-sm text-slate-600">{L.listSectionLead}</p>
					<div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{visible.map((item) => (
							<ListingCard key={item.id} item={item} locale={locale} detailBasePath={listingDetailBasePath} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
