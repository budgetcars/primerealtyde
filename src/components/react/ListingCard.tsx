import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { listingsUi } from '../../i18n/copy/listingsUi';
import { unsplashListingHero } from '../../lib/unsplashPlaceholders';

export function listingHref(detailBase: string, id: string): string {
	return `${detailBase}?id=${encodeURIComponent(id)}`;
}

function formatPrice(euro: number | null, locale: Locale): string {
	const L = listingsUi[locale];
	const num = locale === 'en' ? 'en-GB' : 'de-DE';
	if (euro == null) return L.priceOnRequest;
	return new Intl.NumberFormat(num, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(euro);
}

export function ListingCard({
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
