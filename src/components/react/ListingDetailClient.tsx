import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { numberingLocale } from '../../i18n/locale';
import { listingsUi as copy } from '../../i18n/copy/listingsUi';
import { formatListingPricePrimary, listingPrimaryUsesMonthlySuffix } from '../../lib/listingPriceDisplay';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';
import { unsplashListingHero } from '../../lib/unsplashPlaceholders';

type UiStrings = (typeof copy)['de'];

/** Gleiches Markdown-Styling wie Blog / Textseiten */
const mdWrap =
	'max-w-3xl [&_a]:font-medium [&_a]:text-amber-900 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-amber-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-sm [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-gray-900 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6';

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
	const [activeImageIndex, setActiveImageIndex] = useState(0);
	const [zoomOpen, setZoomOpen] = useState(false);

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
		setActiveImageIndex(0);
		setZoomOpen(false);
	}, [listing?.id]);

	useEffect(() => {
		if (!zoomOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setZoomOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [zoomOpen]);

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

	const galleryImages = (listing.images ?? [])
		.map((u) => (u ?? '').trim())
		.filter(Boolean);
	const activePhoto = galleryImages[activeImageIndex] ?? galleryImages[0] ?? '';
	const heroFallback = unsplashListingHero(listing.id ?? listing.title ?? '');
	const heroUrl = activePhoto && !heroImgBroken ? activePhoto : heroFallback;
	const mapHref =
		listing.latitude != null && listing.longitude != null
			? `https://www.openstreetmap.org/?mlat=${listing.latitude}&mlon=${listing.longitude}#map=14/${listing.latitude}/${listing.longitude}`
			: null;

	const heroAlt = activePhoto && !heroImgBroken ? '' : `${listing.title} – ${L.imgAltFallback}`;
	const descriptionMd = (listing.description ?? '').trim();

	return (
		<>
			<div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
			<div>
				<div className="glass-panel-soft overflow-hidden p-1">
					<button
						type="button"
						onClick={() => {
							if (activePhoto && !heroImgBroken) setZoomOpen(true);
						}}
						className="block w-full"
						aria-label="Bild vergrößern"
					>
						<img
							src={heroUrl}
							alt={heroAlt}
							className="aspect-[4/3] w-full rounded-xl object-cover transition-transform hover:scale-[1.01]"
							onError={() => setHeroImgBroken(true)}
						/>
					</button>
				</div>
				{galleryImages.length > 1 && (
					<div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
						{galleryImages.slice(0, 9).map((url, idx) => (
							<button
								key={`${url}-${idx}`}
								type="button"
								onClick={() => {
									setActiveImageIndex(idx);
									setHeroImgBroken(false);
								}}
								className={`overflow-hidden rounded-lg border shadow-sm transition ${
									idx === activeImageIndex
										? 'border-amber-400 ring-2 ring-amber-300/60'
										: 'border-white/50 hover:border-amber-200/90'
								}`}
								aria-label={`Bild ${idx + 1} anzeigen`}
							>
								<img src={url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
							</button>
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
					<div className={`mt-2 text-slate-800 ${mdWrap}`}>
						{descriptionMd ? (
							<ReactMarkdown>{descriptionMd}</ReactMarkdown>
						) : (
							<p className="leading-relaxed text-slate-700">{L.noDescription}</p>
						)}
					</div>
				</div>
				<a href={listingsListPath} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-amber-900 hover:text-amber-950">
					{L.backToListings}
				</a>
			</div>
			</div>
			{zoomOpen ? (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
					onClick={() => setZoomOpen(false)}
				>
					<img
						src={activePhoto || heroUrl}
						alt={listing.title}
						className="max-h-[92vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					/>
				</div>
			) : null}
		</>
	);
}
