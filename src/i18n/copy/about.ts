import type { Locale } from '../locale';

export const aboutCopy = {
	de: {
		title: 'Über uns',
		metaDescription:
			'Prime Realty – Premium-Immobilien in Montenegro, Zypern, Nordzypern, Türkei, Georgien, Bali und Thailand.',
		eyebrow: 'Prime Realty · Internationale Schwerpunktmärkte',
		introBodyBefore: 'Prime Realty ist Ihr Ansprechpartner für Premium-Immobilien in ',
		marketsLine: 'Montenegro, Zypern, Nordzypern, der Türkei, Georgien, auf Bali und in Thailand',
		introStrongAfter:
			'. Wir begleiten Sie von der Auswahl über die Prüfung bis zum Kauf – klar strukturiert und persönlich.',
		serviceHeading: 'Unser Service von A bis Z',
		serviceLead: 'Strukturiert und persönlich – von der ersten Analyse bis zum erfolgreichen Abschluss.',
		service: [
			{
				letter: 'A',
				title: 'Analyse',
				text: 'Umfassende Marktanalyse und Identifikation der besten Investitionsmöglichkeiten basierend auf Ihren Zielen und Budget.',
			},
			{
				letter: 'B',
				title: 'Beratung',
				text: 'Persönliche Beratung durch erfahrene Immobilienexperten, die die lokalen Märkte und rechtlichen Rahmenbedingungen verstehen.',
			},
			{
				letter: 'C',
				title: 'Compliance',
				text: 'Vollständige Unterstützung bei allen rechtlichen und steuerlichen Aspekten des Immobilienerwerbs.',
			},
			{
				letter: 'D',
				title: 'Durchführung',
				text: 'Professionelle Abwicklung des gesamten Kaufprozesses von der Verhandlung bis zum Abschluss.',
			},
		] as const,
		reasonsHeading: 'Warum Prime Realty?',
		reasonsList: [
			'Exklusiver Zugang zu Premium-Immobilien',
			'Lokale Expertise in internationalen Märkten',
			'Vollständige Transparenz und Kommunikation',
			'Langfristige Betreuung nach dem Kauf',
		],
		ctaListings: 'Zu unseren Immobilien',
	},
	en: {
		title: 'About us',
		metaDescription:
			'Prime Realty – premium real estate in Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand.',
		eyebrow: 'Prime Realty · Focus regions',
		introBodyBefore: 'Prime Realty advises on premium listings in ',
		marketsLine: 'Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand',
		introStrongAfter:
			'. We guide you from shortlisting through due diligence to purchase – structured and personally.',
		serviceHeading: 'Our service end to end',
		serviceLead: 'Structured yet personal — from analysis to closing.',
		service: [
			{
				letter: 'A',
				title: 'Analysis',
				text: 'Thorough context and sourcing aligned with your objectives and budget.',
			},
			{
				letter: 'B',
				title: 'Advisory',
				text: 'Experienced advisers who understand local markets and regulation.',
			},
			{
				letter: 'C',
				title: 'Compliance',
				text: 'Support throughout legal and fiscal aspects of the transaction.',
			},
			{
				letter: 'D',
				title: 'Execution',
				text: 'Professional handling from negotiation to completion.',
			},
		] as const,
		reasonsHeading: 'Why Prime Realty?',
		reasonsList: [
			'Access to curated premium properties',
			'On-the-ground expertise across regions',
			'Transparent collaboration',
			'Long-term stewardship after closing',
		],
		ctaListings: 'Browse listings',
	},
} satisfies Record<Locale, unknown>;
