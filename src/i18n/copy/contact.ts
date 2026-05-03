import type { Locale } from '../locale';

/** Einheitliches Datenmodell; `muted` = reduzierte Textfarbe bei „ geschlossen “ */
export type ContactHoursRow = { days: string; time: string; muted?: boolean };

export type ContactCopy = {
	title: string;
	metaDescription: string;
	intro: string;
	addressHeading: string;
	addressStreet: string;
	addressCity: string;
	addressCountry: string;
	reachHeading: string;
	emailLabel: string;
	phoneLabel: string;
	mailPrimaryCta: string;
	callPrimaryCta: string;
	hoursHeading: string;
	appointmentNote: string;
	mapsOpenLabel: string;
	hours: readonly ContactHoursRow[];
	backHome: string;
};

export const contactCopy: Record<Locale, ContactCopy> = {
	de: {
		title: 'Kontakt',
		metaDescription:
			'Schreiben Sie Prime Realty oder rufen Sie an – Büro Neuhausen bei Stuttgart, Deutschland.',
		intro:
			'Bürodaten und Erreichbarkeit für unseren Standort Deutschland. Für fachliche Rückfragen zu Objekten und Terminen genügt eine kurze Nachricht per E-Mail oder ein Anruf.',
		addressHeading: 'Anschrift',
		addressStreet: 'Panoramastraße 13',
		addressCity: '73765 Neuhausen',
		addressCountry: 'Deutschland',
		reachHeading: 'Geschäftliche Anfragen',
		emailLabel: 'E-Mail',
		phoneLabel: 'Telefon',
		mailPrimaryCta: 'E-Mail senden',
		callPrimaryCta: 'Jetzt anrufen',
		hoursHeading: 'Telefonisch erreichbar',
		appointmentNote:
			'Persönliche Termine sind außerhalb der Telefonzeiten nach Absprache möglich. Bitte setzen Sie sich mit uns in Verbindung.',
		mapsOpenLabel: 'Karte öffnen (Google Maps)',
		hours: [
			{ days: 'Montag – Freitag', time: '9:00 – 18:00' },
			{ days: 'Samstag', time: '10:00 – 14:00' },
			{ days: 'Sonntag', time: 'Geschlossen', muted: true },
		],
		backHome: 'Zurück zur Startseite',
	},
	en: {
		title: 'Contact',
		metaDescription:
			'Reach Prime Realty by email or phone — office in Neuhausen (Stuttgart region), Germany.',
		intro:
			'Office details for our Germany location: address, correspondence and telephone hours. For property-related questions or to arrange a meeting, please write or call.',
		addressHeading: 'Registered office',
		addressStreet: 'Panoramastraße 13',
		addressCity: '73765 Neuhausen',
		addressCountry: 'Germany',
		reachHeading: 'Direct contact',
		emailLabel: 'Email',
		phoneLabel: 'Phone',
		mailPrimaryCta: 'Send email',
		callPrimaryCta: 'Call now',
		hoursHeading: 'Phone hours',
		appointmentNote:
			'In-person meetings outside the phone hours listed above can be scheduled by mutual agreement — please reach out briefly by email or phone.',
		mapsOpenLabel: 'Open in Google Maps',
		hours: [
			{ days: 'Monday – Friday', time: '9:00 – 18:00' },
			{ days: 'Saturday', time: '10:00 – 14:00' },
			{ days: 'Sunday', time: 'Closed', muted: true },
		],
		backHome: 'Back to home',
	},
	ru: {
		title: 'Контакты',
		metaDescription:
			'Связаться с Prime Realty: адрес, телефон, e-mail, часы — офис в Германии.',
		intro:
			'Официальные контакты представительства Prime Realty в Германии: адрес приёма корреспонденции и график дозванивания по телефону. По объектам недвижимости и назначению встреч просим писать на почту или звонить.',
		addressHeading: 'Адрес',
		addressStreet: 'Panoramastraße 13',
		addressCity: '73765 Neuhausen',
		addressCountry: 'Германия',
		reachHeading: 'Служебная переписка и телефон',
		emailLabel: 'Эл. почта',
		phoneLabel: 'Телефон',
		mailPrimaryCta: 'Написать письмо',
		callPrimaryCta: 'Позвонить',
		hoursHeading: 'Приём звонков',
		appointmentNote:
			'Личные визиты возможны по предварительной договорённости также вне указанных окон телефона. Просим заранее связаться.',
		mapsOpenLabel: 'Открыть в Google Картах',
		hours: [
			{ days: 'Понедельник – пятница', time: '9:00 – 18:00' },
			{ days: 'Суббота', time: '10:00 – 14:00' },
			{ days: 'Воскресенье', time: 'Закрыто', muted: true },
		],
		backHome: 'На главную',
	},
	zh: {
		title: '联系我们',
		metaDescription:
			'联系 Prime Realty：地址、电话、邮箱与营业时间（德国办公点）。',
		intro:
			'德国办公点的正式联络信息（地址、通信与电话咨询时间）。如您需要了解房源详情或预约面谈，请优先通过邮件或电话与我们联系。',
		addressHeading: '办公地点',
		addressStreet: 'Panoramastraße 13',
		addressCity: '73765 Neuhausen',
		addressCountry: '德国',
		reachHeading: '业务联络方式',
		emailLabel: '电子邮件',
		phoneLabel: '电话',
		mailPrimaryCta: '发送邮件',
		callPrimaryCta: '拨打电话',
		hoursHeading: '电话咨询时间',
		appointmentNote:
			'如需在非电话咨询时段进行现场面谈，可事先与我们联系并另行约定具体时间。',
		mapsOpenLabel: '在 Google 地图中打开',
		hours: [
			{ days: '周一至周五', time: '9:00 – 18:00' },
			{ days: '周六', time: '10:00 – 14:00' },
			{ days: '周日', time: '休息', muted: true },
		],
		backHome: '返回首页',
	},
};
