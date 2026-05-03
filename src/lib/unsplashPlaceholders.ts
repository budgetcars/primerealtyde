/**
 * Platzhalterbilder (Unsplash Hotlink nach deren Lizenz – Attribution geschätzt).
 * https://unsplash.com/license
 */

const UNSPLASH_REAL_ESTATE_IMAGES = [
	'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=82',
	'https://images.unsplash.com/photo-1600585154363-67eb59e008e9?auto=format&fit=crop&w=1400&q=82',
	'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=82',
	'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=82',
	'https://images.unsplash.com/photo-1519824145371-296894a34499?auto=format&fit=crop&w=1400&q=82',
	'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=82',
];

function stableHash(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return Math.abs(h);
}

/** Stabile Auswahl eines Motivs pro Listing (ohne Netzwerk). */
export function unsplashListingHero(seed?: string): string {
	const i = seed ? stableHash(seed) : 0;
	return UNSPLASH_REAL_ESTATE_IMAGES[i % UNSPLASH_REAL_ESTATE_IMAGES.length]!;
}
