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
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { unsplashListingHero } from '../../lib/unsplashPlaceholders';

function listingHref(detailBase: string, id: string): string {
	return `${detailBase}?id=${encodeURIComponent(id)}`;
}

function formatPrice(euro: number | null, locale: Locale): string {
	const L = listingsUi[locale];
	const num = locale === 'en' ? 'en-GB' : 'de-DE';
	if (euro == null) return L.priceOnRequest;
	return new Intl.NumberFormat(num, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(euro);
}

function listingMatchesQuery(item: Listing, raw: string): boolean {
	const q = raw.trim().toLowerCase();
	if (!q) return true;
	const hay = [
		item.title,
		item.description,
		item.city,
		item.zip,
		item.street,
		item.country,
		item.propertyType,
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	const tokens = q.split(/\s+/).filter(Boolean);
	return tokens.every((t) => hay.includes(t));
}

function ListingCard({
	item,
	locale,
	detailBasePath,
}: {
	item: Listing;
	locale: Locale;
	detailBasePath: string;
}) {
	const firstPhoto = item.images[0]?.trim();
	const poster = firstPhoto ?? unsplashListingHero(item.id ?? item.title ?? '');
	const href = listingHref(detailBasePath, item.id ?? '');

	return (
		<a
			href={href}
			className="group flex flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-lg shadow-slate-900/[0.06] backdrop-blur-md transition hover:-translate-y-1 hover:border-amber-200/90 hover:bg-white/85 hover:shadow-xl hover:shadow-amber-900/10"
		>
			<div className="relative aspect-[4/3] bg-slate-100/90">
				<img
					src={poster}
					alt=""
					className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
					loading="lazy"
				/>
				<span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-800 shadow-sm backdrop-blur-sm">
					{item.propertyType}
				</span>
				{item.featured ? (
					<span className="absolute right-3 top-3 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 shadow-sm backdrop-blur-sm">
						Featured
					</span>
				) : null}
			</div>
			<div className="flex flex-1 flex-col gap-2 p-5">
				<h2 className="text-lg font-semibold tracking-tight text-gray-900 group-hover:text-amber-900">{item.title}</h2>
				<p className="text-sm text-slate-600">
					{item.country ? `${item.country} · ` : ''}
					{item.city}
					{item.zip ? ` · ${item.zip}` : ''}
					{item.street ? ` · ${item.street}` : ''}
				</p>
				<p className="mt-auto pt-2 text-base font-semibold text-amber-950">{formatPrice(item.priceEuro, locale)}</p>
			</div>
		</a>
	);
}

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
