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
			'Offene Kommunikation und verlässliche Informationen',
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
			'Straightforward collaboration',
			'Long-term stewardship after closing',
		],
		ctaListings: 'Browse listings',
	},
	ru: {
		title: 'О нас',
		metaDescription:
			'Prime Realty — недвижимость класса люкс на Черногории, Кипре, Турции, Грузии, Бали и в Таиланде.',
		eyebrow: 'Prime Realty · Регионы фокуса',
		introBodyBefore: 'Prime Realty сопровождает клиентов по объектам класса люкс в регионах ',
		marketsLine: 'Черногория, Кипр, Северный Кипр, Турция, Грузия, Бали и Таиланд',
		introStrongAfter:
			'. От предварительного отбора и проверки до сделки — структурно и с личным вниманием.',
		serviceHeading: 'Сервис под ключ',
		serviceLead:
			'Чёткая структура и живое общение: от первого анализа до закрытия.',
		service: [
			{
				letter: 'A',
				title: 'Аналитика',
				text: 'Контекст рынка и подбор вариантов под ваш бюджет и цели.',
			},
			{
				letter: 'B',
				title: 'Советы',
				text: 'Специалисты, которые понимают местную специфику и регуляторику.',
			},
			{
				letter: 'C',
				title: 'Соответствие',
				text: 'Сопровождение по юридическим и налоговым аспектам сделки.',
			},
			{
				letter: 'D',
				title: 'Реализация',
				text: 'Переговоры, документооборот и финальное оформление.',
			},
		] as const,
		reasonsHeading: 'Почему Prime Realty',
		reasonsList: [
			'Доступ к кураторскому каталогу',
			'Знание личных особенностей каждого направления',
			'Прямота в коммуникации',
			'Поддержка и после ключей',
		],
		ctaListings: 'Каталог объектов',
	},
	zh: {
		title: '关于我们',
		metaDescription:
			'Prime Realty — 在黑山、塞浦路斯、土耳其、格鲁吉亚、巴厘岛与泰国等区域提供高端房产顾问服务。',
		eyebrow: 'Prime Realty · 核心市场',
		introBodyBefore: 'Prime Realty 在 ',
		marketsLine: '黑山、塞浦路斯、北塞浦路斯、土耳其、格鲁吉亚、巴厘岛与泰国',
		introStrongAfter:
			' 等区域甄选高端在售物业——从比价与尽调到成交全流程陪伴。',
		serviceHeading: '端到端服务体系',
		serviceLead:
			'从分析研判到落地的清晰节奏，并保持随时可沟通的团队协作。',
		service: [
			{
				letter: 'A',
				title: '研判',
				text: '结合预算与偏好进行市场理解与资产筛选。',
			},
			{
				letter: 'B',
				title: '顾问',
				text: '熟悉法规与地缘差异的本地化团队提供专业建议。',
			},
			{
				letter: 'C',
				title: '合规',
				text: '围绕交易链路提供法务与税费方面的协助。',
			},
			{
				letter: 'D',
				title: '执行',
				text: '从谈判斡旋直至顺利交房的全流程把控。',
			},
		] as const,
		reasonsHeading: '为什么选择 Prime Realty',
		reasonsList: [
			'进入经过筛选的高端库存',
			'熟悉各区域的在地经验',
			'沟通节奏透明直白',
			'交付之后仍可咨询',
		],
		ctaListings: '浏览房源列表',
	},
} satisfies Record<Locale, unknown>;
