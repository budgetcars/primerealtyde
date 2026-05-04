import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { numberingLocale } from '../../i18n/locale';
import { listingsUi as copy } from '../../i18n/copy/listingsUi';
import { formatListingPricePrimary, listingPrimaryUsesMonthlySuffix } from '../../lib/listingPriceDisplay';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { unsplashListingHero } from '../../lib/unsplashPlaceholders';

type UiStrings = (typeof copy)['de'];

function formatPriceSqm(euro: number | null, locale: Locale): string {
	if (euro == null) return '–';
	const num = numberingLocale(locale);
	return `${new Intl.NumberFormat(num, { maximumFractionDigits: 0 }).format(euro)} €/m²`;
}

function initialIdFromUrl(): string | null {
	if (typeof window === 'undefined') return null;
	const q = new URL(window.location.href).searchParams.get('id');
	const t = q?.trim();
	return t || null;
}

export function ListingDetailClient({
	locale = 'de',
	listingsListPath,
}: {
	locale?: Locale;
	listingsListPath: string;
}) {
	const L = copy[locale] as UiStrings;

	const [skipped] = useState(() => !isFirebaseConfigured());
	const [id] = useState(initialIdFromUrl);
	const [listing, setListing] = useState<Listing | null>(null);
	const [loading, setLoading] = useState(() => !skipped);
	const [error, setError] = useState<string | null>(null);
	const [heroImgBroken, setHeroImgBroken] = useState(false);

	useEffect(() => {
		if (skipped) return;
		if (!id) {
			setLoading(false);
			setListing(null);
			return;
		}
		let cancelled = false;
		const db = getDb();
		getDoc(doc(db, 'listings', id))
			.then((snap) => {
				if (cancelled) return;
				if (!snap.exists()) {
					setListing(null);
					return;
				}
				setListing({ id: snap.id, ...(snap.data() as Omit<Listing, 'id'>) });
			})
			.catch((e: Error) => {
				if (!cancelled) setError(e.message);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [id, skipped]);

	useEffect(() => {
		setHeroImgBroken(false);
	}, [listing?.id]);

	if (skipped) return null;
	if (error)
		return (
			<p className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 backdrop-blur-sm">
				{error}
			</p>
		);
	if (loading)
		return <div className="h-96 max-w-4xl animate-pulse rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm" />;
	if (!id) {
		return (
			<p className="text-slate-600">
				{L.notSelectedLead}{' '}
				<a href={listingsListPath} className="font-semibold text-amber-900 underline decoration-amber-900/40 hover:text-amber-950">
					{L.backToOverview}
				</a>
			</p>
		);
	}
	if (!listing)
		return (
			<p className="text-slate-600">
				{L.notFoundLead}{' '}
				<a href={listingsListPath} className="font-semibold text-amber-900 underline decoration-amber-900/40 hover:text-amber-950">
					{L.backToOverview}
				</a>
			</p>
		);

	const firstPhoto = listing.images[0]?.trim();
	const heroFallback = unsplashListingHero(listing.id ?? listing.title ?? '');
	const heroUrl = firstPhoto && !heroImgBroken ? firstPhoto : heroFallback;
	const mapHref =
		listing.latitude != null && listing.longitude != null
			? `https://www.openstreetmap.org/?mlat=${listing.latitude}&mlon=${listing.longitude}#map=14/${listing.latitude}/${listing.longitude}`
			: null;

	const heroAlt = firstPhoto && !heroImgBroken ? '' : `${listing.title} – ${L.imgAltFallback}`;

	return (
		<div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
			<div>
				<div className="glass-panel-soft overflow-hidden p-1">
					<img
						src={heroUrl}
						alt={heroAlt}
						className="aspect-[4/3] w-full rounded-xl object-cover"
						onError={() => setHeroImgBroken(true)}
					/>
				</div>
				{listing.images.length > 1 && (
					<div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
						{listing.images.slice(1, 9).map((url) => (
							<img key={url} src={url} alt="" className="aspect-square rounded-lg border border-white/50 object-cover shadow-sm" loading="lazy" />
						))}
					</div>
				)}
			</div>
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm font-semibold uppercase tracking-wide text-amber-900">{listing.propertyType}</p>
					{listing.listingType ? (
						<span className="rounded-full border border-white/70 bg-white/50 px-2 py-0.5 text-xs text-slate-700 backdrop-blur-sm">
							{listing.listingType}
						</span>
					) : null}
					{listing.featured ? (
						<span className="rounded-full border border-amber-200/90 bg-amber-100/80 px-2 py-0.5 text-xs font-semibold text-amber-950 backdrop-blur-sm">
							Featured
						</span>
					) : null}
				</div>
				<h1 className="mt-2 font-heading-display text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">{listing.title}</h1>
				<p className="mt-4 text-2xl font-semibold text-amber-950">{formatListingPricePrimary(listing, locale)}</p>
				{listing.pricePerSqmEuro != null && !listingPrimaryUsesMonthlySuffix(listing) ? (
					<p className="mt-1 text-sm text-slate-600">{formatPriceSqm(listing.pricePerSqmEuro, locale)}</p>
				) : null}

				<dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
					<div className="rounded-xl border border-white/70 bg-white/45 p-4 backdrop-blur-md">
						<dt className="text-slate-500">{L.location}</dt>
						<dd className="mt-1 font-medium text-gray-900">
							{listing.country ? <span>{listing.country} · </span> : null}
							{listing.city}
							{listing.zip ? ` · ${listing.zip}` : ''}
						</dd>
					</div>
					<div className="rounded-xl border border-white/70 bg-white/45 p-4 backdrop-blur-md">
						<dt className="text-slate-500">{L.livingArea}</dt>
						<dd className="mt-1 font-medium text-gray-900">{listing.livingSpaceSqm != null ? `${listing.livingSpaceSqm} m²` : '–'}</dd>
					</div>
					<div className="rounded-xl border border-white/70 bg-white/45 p-4 backdrop-blur-md">
						<dt className="text-slate-500">{L.bedrooms}</dt>
						<dd className="mt-1 font-medium text-gray-900">
							{listing.bedrooms != null ? listing.bedrooms : listing.rooms != null ? listing.rooms : '–'}
						</dd>
					</div>
					<div className="rounded-xl border border-white/70 bg-white/45 p-4 backdrop-blur-md">
						<dt className="text-slate-500">{L.bathrooms}</dt>
						<dd className="mt-1 font-medium text-gray-900">{listing.bathrooms != null ? listing.bathrooms : '–'}</dd>
					</div>
				</dl>

				<div className="mt-6 flex flex-wrap gap-3">
					{listing.listingUrl ? (
						<a
							href={listing.listingUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex rounded-xl border border-white/80 bg-white/50 px-4 py-2 text-sm font-semibold text-gray-900 backdrop-blur-sm transition hover:border-amber-200/90 hover:bg-white/80"
						>
							{L.openOriginalListing}
						</a>
					) : null}
					{mapHref ? (
						<a
							href={mapHref}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex rounded-xl border border-white/80 bg-white/50 px-4 py-2 text-sm font-semibold text-gray-900 backdrop-blur-sm transition hover:border-amber-200/90 hover:bg-white/80"
						>
							{L.mapOsm}
						</a>
					) : null}
				</div>

				{listing.features?.length ? (
					<div className="mt-8">
						<h2 className="text-sm font-semibold text-slate-600">{L.features}</h2>
						<ul className="mt-3 flex flex-wrap gap-2">
							{listing.features.map((f, i) => (
								<li
									key={`${f}-${i}`}
									className="rounded-full border border-white/70 bg-white/40 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm"
								>
									{f}
								</li>
							))}
						</ul>
					</div>
				) : null}

				{listing.street ? (
					<p className="mt-6 text-sm text-slate-600">
						<span className="text-slate-500">{L.addressLine} </span>
						{listing.street}
					</p>
				) : null}
				<div className="mt-8 max-w-none">
					<h2 className="text-lg font-semibold text-gray-900">{L.description}</h2>
					<p className="mt-2 leading-relaxed whitespace-pre-wrap text-slate-700">{listing.description || L.noDescription}</p>
				</div>
				<a href={listingsListPath} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-amber-900 hover:text-amber-950">
					{L.backToListings}
				</a>
			</div>
		</div>
	);
}
