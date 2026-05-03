import type { Locale } from '../locale';

export const contactCopy = {
	de: {
		title: 'Kontaktinformationen',
		metaDescription: 'Kontakt Prime Realty – Adresse, Telefon, E-Mail und Öffnungszeiten.',
		line: 'Prime Realty · Real Estate by the Sea',
		address: 'Adresse',
		reachability: 'Erreichbarkeit',
		hoursHeading: 'Öffnungszeiten',
		emailLabel: 'E-Mail',
		phoneLabel: 'Telefon',
		appointmentNote: 'Termine außerhalb der Zeiten nach Vereinbarung – kurze Nachricht genügt.',
		hours: [
			{ days: 'Montag – Freitag', time: '9:00 – 18:00' },
			{ days: 'Samstag', time: '10:00 – 14:00' },
			{ days: 'Sonntag', time: 'Geschlossen' },
		] as const,
		backHome: '← Zur Startseite',
	},
	en: {
		title: 'Contact',
		metaDescription: 'Contact Prime Realty – address, phone, email and opening hours.',
		line: 'Prime Realty · Real Estate by the Sea',
		address: 'Address',
		reachability: 'How to reach us',
		hoursHeading: 'Opening hours',
		emailLabel: 'Email',
		phoneLabel: 'Phone',
		appointmentNote: 'Meetings outside these hours by appointment – a brief message is enough.',
		hours: [
			{ days: 'Monday – Friday', time: '9:00 – 18:00' },
			{ days: 'Saturday', time: '10:00 – 14:00' },
			{ days: 'Sunday', time: 'Closed' },
		] as const,
		backHome: '← Back to home',
	},
} satisfies Record<Locale, unknown>;
