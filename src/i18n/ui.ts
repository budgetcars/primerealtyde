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
			'Premium-Immobilien mit internationalem Zugriff – Schwerpunkt Montenegro, Zypern, Nordzypern, Türkei, Georgien, Bali und Thailand.',
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
			'Premium real estate with cross-border reach – focus on Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand.',
		footerNav: 'Navigation',
		footerLegal: 'Legal',
		linkImprint: 'Imprint (DE)',
		linkPrivacy: 'Privacy (DE)',
		linkTerms: 'Terms (DE)',
		linkNt: 'Terms of use (DE)',
		linkCookies: 'Cookie settings (DE)',
		footerContact: 'Contact',
		linkContactDetails: 'Details',
		footerHoursIntro: 'Mon–Fri 9:00–18:00 · Sat 10:00–14:00 · Sun closed · ',
		footerLanguages: 'Languages',
		languageList: 'Русский · Српски · English · Deutsch',
		rightsReserved: 'All rights reserved.',
	},
} satisfies Record<Locale, Record<string, string>>;

export type UiStrings = typeof ui.de;
