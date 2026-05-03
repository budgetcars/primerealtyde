import type { Locale } from './locale';

export const ui = {
	de: {
		navHome: 'Start',
		navAbout: 'Über uns',
		navListings: 'Immobilien',
		navPartner: 'Partner werden',
		navContact: 'Kontakt',
		navAdmin: 'Verwaltung',
		navAdminAria: 'Interne Verwaltung',
		tagline: 'Premium-Immobilien · Montenegro · Zypern · Türkei · Georgien · Bali · Thailand',
		langAria: 'Sprache',
		langDe: 'Deutsch',
		langEn: 'English',

		footerLead: 'Prime Realty',
		footerIntro:
			'Premium-Immobilien mit internationalem Zugriff und persönlicher Beratung für ausgewählte Destinationen.',
		footerNav: 'Navigation',
		footerLegal: 'Rechtliches',
		linkImprint: 'Impressum',
		linkPrivacy: 'Datenschutz',
		linkTerms: 'AGB',
		linkNt: 'Nutzungsbedingungen',
		linkCookies: 'Cookie-Einstellungen',
		footerContact: 'Kontakt',
		linkContactDetails: 'Details',
		footerHoursIntro: 'Mo–Fr 9:00–18:00 · Sa 10:00–14:00 · So geschlossen · ',
		footerLanguages: 'Sprachen',
		languageList: 'Русский · Српски · English · Deutsch',
		rightsReserved: 'Alle Rechte vorbehalten.',
	},
	en: {
		navHome: 'Home',
		navAbout: 'About',
		navListings: 'Listings',
		navPartner: 'Become a partner',
		navContact: 'Contact',
		navAdmin: 'Admin',
		navAdminAria: 'Internal admin',
		tagline:
			'Premium real estate · Montenegro · Cyprus · Turkey · Georgia · Bali · Thailand',
		langAria: 'Language',
		langDe: 'Deutsch',
		langEn: 'English',

		footerLead: 'Prime Realty',
		footerIntro:
			'Premium real estate with international reach and personal advisory across selected destinations.',
		footerNav: 'Navigation',
		footerLegal: 'Legal',
		linkImprint: 'Imprint',
		linkPrivacy: 'Privacy',
		linkTerms: 'Brokerage terms',
		linkNt: 'Platform terms',
		linkCookies: 'Cookie settings',
		footerContact: 'Contact',
		linkContactDetails: 'Details',
		footerHoursIntro: 'Mon–Fri 9:00–18:00 · Sat 10:00–14:00 · Sun closed · ',
		footerLanguages: 'Languages',
		languageList: 'Русский · Српски · English · Deutsch',
		rightsReserved: 'All rights reserved.',
	},
} satisfies Record<Locale, Record<string, string>>;

export type UiStrings = typeof ui.de;
