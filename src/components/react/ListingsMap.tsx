import { useEffect, useRef, useState } from 'react';
import type { Listing } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { listingsUi } from '../../i18n/copy/listingsUi';
import 'leaflet/dist/leaflet.css';

function listingHref(detailBase: string, id: string): string {
	return `${detailBase}?id=${encodeURIComponent(id)}`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatPriceShort(euro: number | null, locale: Locale): string {
	const L = listingsUi[locale];
	const num = locale === 'en' ? 'en-GB' : 'de-DE';
	if (euro == null) return L.priceOnRequest;
	return new Intl.NumberFormat(num, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(euro);
}

const DEFAULT_CENTER: [number, number] = [42.65, 18.0];
const DEFAULT_ZOOM = 5;

export function ListingsMap({
	listings,
	detailBasePath,
	locale,
	className = '',
}: {
	listings: Listing[];
	detailBasePath: string;
	locale: Locale;
	className?: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<import('leaflet').Map | null>(null);
	const groupRef = useRef<import('leaflet').FeatureGroup | null>(null);
	const leafletRef = useRef<typeof import('leaflet') | null>(null);
	const [mapReady, setMapReady] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let cancelled = false;

		import('leaflet').then((L) => {
			if (cancelled || !containerRef.current) return;
			leafletRef.current = L;

			const map = L.map(el, {
				zoomControl: true,
				scrollWheelZoom: true,
			}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
				maxZoom: 19,
			}).addTo(map);

			const fg = L.featureGroup().addTo(map);
			groupRef.current = fg;
			mapRef.current = map;
			setMapReady(true);

			requestAnimationFrame(() => map.invalidateSize());
		});

		return () => {
			cancelled = true;
			setMapReady(false);
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
			groupRef.current = null;
			leafletRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!mapReady) return;
		const L = leafletRef.current;
		const map = mapRef.current;
		const group = groupRef.current;
		if (!L || !map || !group) return;

		group.clearLayers();

		const withCoords = listings.filter(
			(it) => it.latitude != null && it.longitude != null && !Number.isNaN(it.latitude) && !Number.isNaN(it.longitude),
		);

		if (withCoords.length === 0) {
			map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
			requestAnimationFrame(() => map.invalidateSize());
			return;
		}

		const bounds = L.latLngBounds([]);

		for (const item of withCoords) {
			const lat = item.latitude as number;
			const lng = item.longitude as number;
			const href = listingHref(detailBasePath, item.id ?? '');
			const title = escapeHtml(item.title ?? '');
			const price = escapeHtml(formatPriceShort(item.priceEuro, locale));
			const marker = L.circleMarker([lat, lng], {
				radius: 10,
				fillColor: '#b45309',
				color: '#ffffff',
				weight: 2,
				opacity: 1,
				fillOpacity: 0.92,
			});
			marker.bindPopup(
				`<div class="text-sm"><a class="font-semibold text-amber-900 hover:underline" href="${href}">${title}</a><div class="mt-1 text-slate-600">${price}</div></div>`,
				{ maxWidth: 260 },
			);
			marker.addTo(group);
			bounds.extend([lat, lng]);
		}

		if (bounds.isValid()) {
			map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
		}

		requestAnimationFrame(() => map.invalidateSize());
	}, [listings, detailBasePath, locale, mapReady]);

	return (
		<div
			ref={containerRef}
			className={`h-[55vh] min-h-[360px] max-h-[640px] w-full rounded-2xl border border-slate-200/80 bg-slate-100/80 ${className}`}
		/>
	);
}
