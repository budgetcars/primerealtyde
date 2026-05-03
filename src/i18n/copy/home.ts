import type { Locale } from '../locale';

type HomeCopy = {
	title: string;
	metaDescription: string;
	heroEyebrow: string;
	heroH1: string;
	heroLead: string;
	heroBullets: readonly [string, string, string];
	searchLabel: string;
	searchPlaceholder: string;
	searchSubmit: string;
	ctaPrimary: string;
	ctaSecondary: string;
	spotlightHeading: string;
	spotlightLead: string;
	spotlightAllLink: string;
	spotlight: ReadonlyArray<{ title: string; location: string; price: string }>;
	categoryLabel: string;
	categoryH2: string;
	categoryLead: string;
	categoryCta: string;
	focusHeading: string;
	focusLead: string;
	focusAll: string;
	journalHeading: string;
	journalLead: string;
	journalReadMore: string;
	journal: ReadonlyArray<{ date: string; title: string; excerpt: string }>;
	pillarsHeading: string;
	pillars: ReadonlyArray<{ title: string; text: string }>;
	regionsHeading: string;
	regionsLead: string;
	regionsAll: string;
	stayHeading: string;
	stayLead: string;
	stayContact: string;
	stayAbout: string;
};

export const home: Record<Locale, HomeCopy> = {
	de: {
		title: 'Prime Realty · Premium Immobilien',
		metaDescription:
			'Premium-Immobilien mit internationalem Zugriff – Montenegro, Zypern, Nordzypern, Türkei, Georgien, Bali und Thailand. Transparente Daten und persönliche Beratung.',
		heroEyebrow: 'Prime Realty · Mittelmeer · Schwarzes Meer · Südostasien',
		heroH1: 'Premium-Immobilien mit internationalem Zugriff',
		heroLead:
			'Transparente Daten, strukturierte Beratung und Zugang zu ausgewählten Objekten – Schwerpunkt Montenegro, Zypern, Nordzypern, Türkei, Georgien, Bali und Thailand.',
		heroBullets: ['Ausgewählte Objekte', 'Persönliche Beratung', 'Mehrsprachiges Team'] as const,
		searchLabel: 'Immobilien suchen',
		searchPlaceholder: 'Ort, Stichwort oder Objekttyp …',
		searchSubmit: 'Suchen',
		ctaPrimary: 'Immobilien durchsuchen',
		ctaSecondary: 'Anfrage senden',
		spotlightHeading: 'Im Rampenlicht',
		spotlightLead: 'Einblicke in Lagen und Architektur – zu allen aktuellen Angeboten.',
		spotlightAllLink: 'Alle Objekte →',
		spotlight: [
			{ title: 'Adria & Buchten', location: 'Montenegro', price: 'auf Anfrage' },
			{ title: 'Mittelmeer', location: 'Zypern', price: 'auf Anfrage' },
			{ title: 'Küste & Golf', location: 'Nordzypern', price: 'auf Anfrage' },
			{ title: 'Riviera & Metropolen', location: 'Türkei', price: 'auf Anfrage' },
			{ title: 'Schwarzes Meer & Kaukasus', location: 'Georgien', price: 'auf Anfrage' },
			{ title: 'Tropen & Villas', location: 'Bali', price: 'auf Anfrage' },
			{ title: 'Inseln & Küste', location: 'Thailand', price: 'auf Anfrage' },
		],
		categoryLabel: 'Angebot',
		categoryH2: 'Immobilien',
		categoryLead:
			'Von der Ferienwohnung bis zur Villa – in unseren Schwerpunktmärkten am Mittelmeer, am Schwarzen Meer und in Südostasien, mit klaren Angaben und persönlicher Erreichbarkeit.',
		categoryCta: 'Zu den Immobilien →',
		focusHeading: 'Aktuell im Fokus',
		focusLead: 'Eine aktuelle Auswahl – stöbern Sie in den neuesten Exposés.',
		focusAll: 'Alle anzeigen →',
		journalHeading: 'Einblicke',
		journalLead: 'Region, Team und Kontakt – alles für Ihre nächsten Schritte.',
		journalReadMore: 'Weiterlesen →',
		journal: [
			{
				date: 'Regionen',
				title: 'Unsere Schwerpunkte',
				excerpt:
					'Von Montenegro über Zypern und die Türkei bis Georgien, Bali und Thailand – passende Objekte in der Übersicht.',
			},
			{
				date: 'Über uns',
				title: 'Prime Realty',
				excerpt: 'Wer wir sind und wie wir Sie von der ersten Orientierung bis zum erfolgreichen Abschluss begleiten.',
			},
			{
				date: 'Kontakt',
				title: 'Direkt ins Gespräch',
				excerpt: 'Erreichbarkeit, Sprachen und nächste Schritte – persönlich und unkompliziert.',
			},
		],
		pillarsHeading: 'So arbeiten wir',
		pillars: [
			{
				title: 'Kuratierte Auswahl',
				text: 'Qualität statt Masse – sorgfältig ausgewählte Objekte und verlässliche Informationen.',
			},
			{
				title: 'Beratung & Sprachen',
				text: 'Mehrsprachige Expertise für internationale Märkte.',
			},
			{
				title: 'Prozess & Abschluss',
				text: 'Strukturierte Abwicklung und Transparenz bis zum erfolgreichen Abschluss.',
			},
		],
		regionsHeading: 'Beliebte Regionen',
		regionsLead: 'Schnell zur Übersicht – unter Immobilien filtern und vergleichen.',
		regionsAll: 'Alle Objekte in der Übersicht →',
		stayHeading: 'Bleiben Sie informiert',
		stayLead: 'Objektupdates und Beratung – wir melden uns zeitnah bei Ihrer Anfrage.',
		stayContact: 'Kontakt aufnehmen',
		stayAbout: 'Über Prime Realty',
	},
	en: {
		title: 'Prime Realty · Premium real estate',
		metaDescription:
			'Premium real estate with international reach – Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand. Clear information and personal advice.',
		heroEyebrow: 'Prime Realty · Mediterranean · Black Sea · Southeast Asia',
		heroH1: 'Premium real estate with international reach',
		heroLead:
			'Clear information, structured advisory and access to selected properties – focusing on Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand.',
		heroBullets: ['Curated inventory', 'Personal advice', 'Multilingual team'] as const,
		searchLabel: 'Search listings',
		searchPlaceholder: 'Location, keyword or property type …',
		searchSubmit: 'Search',
		ctaPrimary: 'Browse listings',
		ctaSecondary: 'Send an inquiry',
		spotlightHeading: 'Spotlight',
		spotlightLead: 'A glimpse of settings and architecture – see all current offers.',
		spotlightAllLink: 'All properties →',
		spotlight: [
			{ title: 'Adriatic bays', location: 'Montenegro', price: 'On request' },
			{ title: 'Mediterranean', location: 'Cyprus', price: 'On request' },
			{ title: 'Coast & golf', location: 'Northern Cyprus', price: 'On request' },
			{ title: 'Coastline & cities', location: 'Turkey', price: 'On request' },
			{ title: 'Black Sea & Caucasus', location: 'Georgia', price: 'On request' },
			{ title: 'Tropic villas', location: 'Bali', price: 'On request' },
			{ title: 'Islands & coast', location: 'Thailand', price: 'On request' },
		],
		categoryLabel: 'Collection',
		categoryH2: 'Real estate',
		categoryLead:
			'From apartments to estates – across our Mediterranean, Black Sea and Southeast Asia corridors, with upfront detail and approachable service.',
		categoryCta: 'Explore listings →',
		focusHeading: 'Featured now',
		focusLead: 'Fresh highlights from the catalogue.',
		focusAll: 'View all →',
		journalHeading: 'Stories',
		journalLead: 'Regions, the team and how to reach us next.',
		journalReadMore: 'Continue →',
		journal: [
			{
				date: 'Regions',
				title: 'Where we focus',
				excerpt:
					'From Montenegro and Cyprus via Turkey to Georgia, Bali and Thailand – browse everything in one place.',
			},
			{
				date: 'About',
				title: 'Prime Realty',
				excerpt: 'Who we are and how we support you from first orientation to closing.',
			},
			{
				date: 'Contact',
				title: 'Start a conversation',
				excerpt: 'Availability, languages and practical next steps – straightforward and approachable.',
			},
		],
		pillarsHeading: 'How we work',
		pillars: [
			{
				title: 'Curated catalogue',
				text: 'Quality over sheer volume — selected assets with dependable information.',
			},
			{
				title: 'Advice & languages',
				text: 'Multilingual competence for buyers across borders.',
			},
			{
				title: 'Structure & closing',
				text: 'Clear deal flow and transparency through completion.',
			},
		],
		regionsHeading: 'Popular regions',
		regionsLead: 'Jump straight to the overview and compare locations.',
		regionsAll: 'Open the listings overview →',
		stayHeading: 'Stay informed',
		stayLead: 'Portfolio updates and advice — we respond quickly to enquiries.',
		stayContact: 'Contact us',
		stayAbout: 'About Prime Realty',
	},
};

export const regions = ['Montenegro', 'Zypern', 'Nordzypern', 'Türkei', 'Georgien', 'Bali', 'Thailand'] as const;
export const regionsEn = ['Montenegro', 'Cyprus', 'Northern Cyprus', 'Turkey', 'Georgia', 'Bali', 'Thailand'] as const;
