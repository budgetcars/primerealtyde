import type { Locale } from '../i18n/locale';

/** Einheitliches Objektmodell: manuell, OpenImmo oder Adriom-Feed */

export type ListingSource = 'xml' | 'manual' | 'adriom';

/** Blog (Collection `blogPosts`) — öffentlich lesbar wenn `published` */
export interface BlogPostDoc {
	id?: string;
	locale: Locale;
	slug: string;
	title: string;
	excerpt: string;
	bodyMarkdown: string;
	published: boolean;
	updatedAt?: { seconds: number; nanoseconds: number } | null;
}

/** Statische Unterseiten (Collection `siteTexts`) — gleicher Slug wie die Route (z. B. ueber-uns, impressum) */
export interface SiteTextDoc {
	id?: string;
	locale: Locale;
	slug: string;
	title: string;
	bodyMarkdown: string;
	published: boolean;
	updatedAt?: { seconds: number; nanoseconds: number } | null;
}

export interface Listing {
	id?: string;
	title: string;
	description: string;
	priceEuro: number | null;
	/** Kaltmiete / Monatsmiete (z. B. Adriom &lt;pricePerMonth&gt;) – Anzeige „… € / Monat“ */
	pricePerMonthEuro?: number | null;
	livingSpaceSqm: number | null;
	rooms: number | null;
	propertyType: string;
	city: string;
	zip: string;
	street: string;
	images: string[];
	source: ListingSource;
	externalId?: string;
	createdAt?: { seconds: number; nanoseconds: number } | null;

	/** Adriom / erweiterte Felder */
	listingUrl?: string;
	listingType?: string;
	featured?: boolean;
	pricePerSqmEuro?: number | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	country?: string;
	latitude?: number | null;
	longitude?: number | null;
	features?: string[];
	currency?: string;
	/** Feed-Metadaten (z. B. täglicher Sync) */
	xmlFeedSource?: string;
	xmlFeedSourceUrl?: string;
	xmlFeedGeneratedAt?: string;
	remoteCreatedAt?: string;
	remoteUpdatedAt?: string;
	syncedAt?: { seconds: number; nanoseconds: number } | null;

	/** Katalog: Firestore-Filter/Sortierung (beim Schreiben gesetzt, z. B. via Admin-Import) */
	browseCountryKey?: string;
	browseTypeKey?: string;
	sortCreatedAtMs?: number;
	sortPricePrimary?: number;
	bedroomsNum?: number;
	cityLower?: string;
}

export type ListingInput = Omit<Listing, 'id' | 'createdAt' | 'syncedAt'>;
