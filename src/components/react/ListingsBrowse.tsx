import { useEffect, useState } from 'react';
import {
	collection,
	documentId,
	getDocs,
	limit,
	orderBy,
	query,
	startAfter,
	where,
	type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { listingsUi } from '../../i18n/copy/listingsUi';
import {
	LISTINGS_CATALOG_PAGE_SIZE,
	encodeListingCatalogCursor,
	hasActiveListingBrowseFilters,
	listingMatchesBrowseFilters,
	parseListingCatalogCursor,
	sanitizeListingBrowseFilters,
} from '../../lib/listingsQuery';
import { withLocalePath } from '../../i18n/locale';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { ListingCard } from './ListingCard';
import { ListingsMap } from './ListingsMap';

function sortListingsForCatalog(list: Listing[], sort: ListingBrowseSortKey): void {
	const prim = (x: Listing) => x.sortPricePrimary ?? -1;
	const ms = (x: Listing) => x.sortCreatedAtMs ?? (x.createdAt?.seconds ?? 0) * 1000;
	const id = (x: Listing) => x.id ?? '';
	if (sort === 'created_desc') {
		list.sort((a, b) => ms(b) - ms(a) || id(b).localeCompare(id(a)));
	} else if (sort === 'created_asc') {
		list.sort((a, b) => ms(a) - ms(b) || id(a).localeCompare(id(b)));
	} else if (sort === 'price_desc') {
		list.sort((a, b) => prim(b) - prim(a) || id(b).localeCompare(id(a)));
	} else {
		list.sort((a, b) => prim(a) - prim(b) || id(a).localeCompare(id(b)));
	}
}

function filtersFromBrowser(): ListingBrowseFilters {
	return sanitizeListingBrowseFilters(new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''));
}

function buildOrderConstraints(sort: ListingBrowseSortKey): QueryConstraint[] {
	if (sort === 'price_asc' || sort === 'price_desc') {
		const dir = sort === 'price_asc' ? 'asc' : 'desc';
		return [orderBy('sortPricePrimary', dir), orderBy(documentId(), dir)];
	}
	const dir = sort === 'created_asc' ? 'asc' : 'desc';
	return [orderBy('sortCreatedAtMs', dir), orderBy(documentId(), dir)];
}

function buildIndexedWhere(f: ListingBrowseFilters): QueryConstraint[] {
	const c: QueryConstraint[] = [];
	if (f.countrySlug) c.push(where('browseCountryKey', '==', f.countrySlug));
	if (f.propertyTypeSlug) c.push(where('browseTypeKey', '==', f.propertyTypeSlug));
	return c;
}

async function sampleCatalogIsIndexed(db: ReturnType<typeof getDb>): Promise<boolean> {
	const snap = await getDocs(query(collection(db, 'listings'), limit(40)));
	if (snap.empty) return true;
	return snap.docs.some((d) => typeof (d.data() as Listing).browseCountryKey === 'string');
}

function patchListingSearchUrl(patch: Record<string, string | null | undefined>): string {
	const u = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
	const p = u.searchParams;
	for (const [k, v] of Object.entries(patch)) {
		if (v == null || v === '') p.delete(k);
		else p.set(k, String(v));
	}
	const qs = p.toString();
	return qs ? `${u.pathname}?${qs}` : u.pathname;
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
	const [useLegacyCatalog, setUseLegacyCatalog] = useState(false);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [legacyTotal, setLegacyTotal] = useState<number | null>(null);
	const [indexedQueryFailed, setIndexedQueryFailed] = useState(false);

	useEffect(() => {
		if (skipped) return;
		let cancelled = false;
		const db = getDb();
		const f = filtersFromBrowser();

		async function run() {
			setLoading(true);
			setErr(null);
			setNextCursor(null);
			setLegacyTotal(null);
			setIndexedQueryFailed(false);
			try {
				const indexed = await sampleCatalogIsIndexed(db);
				if (cancelled) return;

				if (!indexed) {
					setUseLegacyCatalog(true);
					const qSnap = query(collection(db, 'listings'));
					const snap = await getDocs(qSnap);
					if (cancelled) return;
					const list: Listing[] = [];
					snap.forEach((d) => {
						list.push({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) });
					});
					const matched = list.filter((it) => listingMatchesBrowseFilters(it, f));
					sortListingsForCatalog(matched, f.sort);
					const maxPage = Math.max(1, Math.ceil(matched.length / LISTINGS_CATALOG_PAGE_SIZE));
					const page = Math.min(Math.max(1, f.page), maxPage);
					const start = (page - 1) * LISTINGS_CATALOG_PAGE_SIZE;
					setItems(matched.slice(start, start + LISTINGS_CATALOG_PAGE_SIZE));
					setLegacyTotal(matched.length);
					return;
				}

				setUseLegacyCatalog(false);
				const PAGE = LISTINGS_CATALOG_PAGE_SIZE;
				const orderC = buildOrderConstraints(f.sort);
				const whereC = buildIndexedWhere(f);
				const out: Listing[] = [];
				let lastRead: QueryDocumentSnapshot | null = null;

				for (let bi = 0; bi < 18 && out.length < PAGE; bi++) {
					const startParts: QueryConstraint[] = [];
					if (bi === 0 && f.after) {
						const c = parseListingCatalogCursor(f.after);
						if (c) startParts.push(startAfter(c.v, c.id));
					} else if (bi > 0 && lastRead) {
						startParts.push(startAfter(lastRead));
					}

					const qy = query(collection(db, 'listings'), ...whereC, ...orderC, ...startParts, limit(PAGE));
					let snap;
					try {
						snap = await getDocs(qy);
					} catch (e: unknown) {
						if (cancelled) return;
						setIndexedQueryFailed(true);
						const msg = e instanceof Error ? e.message : String(e);
						setErr(msg);
						setItems([]);
						return;
					}
					if (cancelled) return;
					if (snap.empty) break;

					for (const d of snap.docs) {
						const item = { id: d.id, ...(d.data() as Omit<Listing, 'id'>) } as Listing;
						if (!listingMatchesBrowseFilters(item, f)) continue;
						out.push(item);
						if (out.length >= PAGE) break;
					}

					lastRead = snap.docs[snap.docs.length - 1] ?? null;
					const fullPageFromServer = snap.size >= PAGE;
					if (!fullPageFromServer) break;
					if (out.length >= PAGE) break;
				}

				if (cancelled) return;
				setItems(out);
				if (out.length === PAGE && lastRead) {
					const data = lastRead.data() as Listing;
					const pseudo = { id: lastRead.id, ...data } as Listing;
					setNextCursor(encodeListingCatalogCursor(pseudo, f.sort));
				} else {
					setNextCursor(null);
				}
			} catch (e: unknown) {
				if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void run();
		return () => {
			cancelled = true;
		};
	}, [skipped]);

	const f = typeof window !== 'undefined' ? filtersFromBrowser() : sanitizeListingBrowseFilters(new URLSearchParams());
	const visibleWithCoords = items.filter(
		(it) => it.latitude != null && it.longitude != null && !Number.isNaN(it.latitude) && !Number.isNaN(it.longitude),
	);

	const emptyCatalog =
		!skipped && !loading && !err && items.length === 0 && !hasActiveListingBrowseFilters(f) && !indexedQueryFailed;
	const emptyFiltered =
		!skipped && !loading && !err && items.length === 0 && hasActiveListingBrowseFilters(f) && !indexedQueryFailed;

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
			<div className="space-y-4">
				<p className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 backdrop-blur-sm">
					{err}
				</p>
				{indexedQueryFailed ? <p className="text-xs text-slate-600">{L.catalogIndexErrorHint}</p> : null}
			</div>
		);

	const nextHref =
		typeof window !== 'undefined' && nextCursor
			? patchListingSearchUrl({ after: nextCursor, page: '' })
			: typeof window !== 'undefined' && useLegacyCatalog && legacyTotal != null
				? (() => {
						const nextPage = f.page + 1;
						const maxPage = Math.ceil(legacyTotal / LISTINGS_CATALOG_PAGE_SIZE);
						return nextPage <= maxPage ? patchListingSearchUrl({ page: String(nextPage), after: '' }) : null;
					})()
				: null;

	const prevHref =
		typeof window !== 'undefined' && useLegacyCatalog && f.page > 1
			? patchListingSearchUrl({
					page: f.page <= 2 ? '' : String(f.page - 1),
					after: '',
				})
			: typeof window !== 'undefined' && !useLegacyCatalog && f.after
				? patchListingSearchUrl({ after: '', page: '' })
				: null;

	const firstHref = typeof window !== 'undefined' ? patchListingSearchUrl({ after: '', page: '' }) : listingsListPath;

	return (
		<div className="space-y-10">
			{useLegacyCatalog ? (
				<p className="rounded-xl border border-amber-200/80 bg-amber-50/85 px-4 py-2 text-xs leading-relaxed text-amber-950 backdrop-blur-sm">
					{L.catalogLegacyHint}
				</p>
			) : null}

			<div className="relative">
				<ListingsMap listings={items} detailBasePath={listingDetailBasePath} locale={locale} />
				{items.length > 0 && visibleWithCoords.length === 0 ? (
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
					{f.q.trim() ? `${L.noHits} „${f.q.trim()}“. ` : `${L.noHitsFilters} `}
					<a href={listingsListPath} className="font-semibold text-amber-900 underline decoration-amber-400/70 hover:text-amber-950">
						{L.resetFilter}
					</a>
				</p>
			) : (
				<div>
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<h2 className="font-heading-display text-xl font-semibold tracking-tight text-gray-900 md:text-2xl">{L.listSectionTitle}</h2>
							<p className="mt-1 text-sm text-slate-600">{L.listSectionLead}</p>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
							{useLegacyCatalog && legacyTotal != null ? (
								<span>
									{L.catalogPageInfo
										.replace('{from}', String((f.page - 1) * LISTINGS_CATALOG_PAGE_SIZE + 1))
										.replace('{to}', String(Math.min(f.page * LISTINGS_CATALOG_PAGE_SIZE, legacyTotal)))
										.replace('{total}', String(legacyTotal))}
								</span>
							) : (
								<span>{L.catalogPageIndexedInfo.replace('{n}', String(items.length))}</span>
							)}
						</div>
					</div>

					<div className="mt-4 flex flex-wrap gap-2">
						{prevHref ? (
							<a
								href={prevHref}
								className="inline-flex rounded-xl border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 backdrop-blur-sm hover:border-amber-300"
							>
								{L.catalogPrev}
							</a>
						) : null}
						{nextHref ? (
							<a
								href={nextHref}
								className="inline-flex rounded-xl border border-accent/35 bg-accent/12 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-accent/20"
							>
								{L.catalogNext}
							</a>
						) : null}
						{(f.after || f.page > 1) && !nextHref ? (
							<a
								href={firstHref}
								className="inline-flex rounded-xl border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300"
							>
								{L.catalogFirst}
							</a>
						) : null}
					</div>

					<div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{items.map((item) => (
							<ListingCard key={item.id} item={item} locale={locale} detailBasePath={listingDetailBasePath} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
