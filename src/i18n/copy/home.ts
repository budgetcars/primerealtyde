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
	heroSearchFootnote: string;
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
			'Premium-Immobilien in Montenegro, Zypern, Nordzypern, Türkei, Georgien, Bali und Thailand.',
		heroEyebrow: 'Prime Realty · Mittelmeer · Schwarzes Meer · Südostasien',
		heroH1: 'Premium-Immobilien weltweit',
		heroLead:
			'Schwerpunktmärkte: Montenegro, Zypern, Nordzypern, Türkei, Georgien, Bali und Thailand – vom ersten Gespräch bis zur Abwicklung.',
		heroBullets: ['Ausgewählte Objekte', 'Persönliche Beratung', 'Mehrsprachiges Team'] as const,
		searchLabel: 'Immobilien suchen',
		searchPlaceholder: 'Ort, Stichwort oder Objekttyp …',
		searchSubmit: 'Suchen',
		heroSearchFootnote: 'Optionales Stichwort oben dazu – dann Treffer gleich auf Karte und Liste.',
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
				text: 'Begleitung von der ersten Auswahl bis zum erfolgreichen Abschluss.',
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
			'Premium real estate in Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand.',
		heroEyebrow: 'Prime Realty · Mediterranean · Black Sea · Southeast Asia',
		heroH1: 'Premium homes worldwide',
		heroLead:
			'Focus regions: Montenegro, Cyprus, Northern Cyprus, Turkey, Georgia, Bali and Thailand – from first contact through closing.',
		heroBullets: ['Curated inventory', 'Personal advice', 'Multilingual team'] as const,
		searchLabel: 'Search listings',
		searchPlaceholder: 'Location, keyword or property type …',
		searchSubmit: 'Search',
		heroSearchFootnote: 'Optional keyword above — matching homes show on the map and in the list.',
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
				text: 'Support from early shortlisting through closing.',
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
	ru: {
		title: 'Prime Realty · премиальная недвижимость',
		metaDescription:
			'Недвижимость класса люкс: Черногория, Кипр, Северный Кипр, Турция, Грузия, Бали и Таиланд.',
		heroEyebrow: 'Prime Realty · Средиземноморье · Чёрное море · Юго-Восточная Азия',
		heroH1: 'Премиальная недвижимость',
		heroLead:
			'Наш фокус: Черногория, Кипр, Северный Кипр, Турция, Грузия, Бали и Таиланд — от первого контакта до сделки.',
		heroBullets: ['Тщательно отобранные объекты', 'Личное сопровождение', 'Мультиязычная команда'] as const,
		searchLabel: 'Поиск объектов',
		searchPlaceholder: 'Город, ключевые слова, тип недвижимости …',
		searchSubmit: 'Найти',
		heroSearchFootnote:
			'Дополните опционально полем выше ключевым словом — совпадения появятся на карте и в списке.',
		ctaPrimary: 'Смотреть каталог',
		ctaSecondary: 'Запрос',
		spotlightHeading: 'Подборка',
		spotlightLead: 'Разные локации и архитектура — все актуальные предложения в каталоге.',
		spotlightAllLink: 'Все объекты →',
		spotlight: [
			{ title: 'Адриатика и бухты', location: 'Черногория', price: 'по запросу' },
			{ title: 'Средиземноморье', location: 'Кипр', price: 'по запросу' },
			{ title: 'Берег и гольф', location: 'Северный Кипр', price: 'по запросу' },
			{ title: 'Ривьера и города', location: 'Турция', price: 'по запросу' },
			{ title: 'Чёрное море и Кавказ', location: 'Грузия', price: 'по запросу' },
			{ title: 'Тропики и виллы', location: 'Бали', price: 'по запросу' },
			{ title: 'Острова и побережье', location: 'Таиланд', price: 'по запросу' },
		],
		categoryLabel: 'Каталог',
		categoryH2: 'Объекты',
		categoryLead:
			'От апартаментов до резиденций — регионы Средиземноморья, Чёрного моря и Юго-Восточной Азии: прозрачная информация и доступная команда.',
		categoryCta: 'В каталог →',
		focusHeading: 'Сейчас в фокусе',
		focusLead: 'Свежее в каталоге — выбирайте и сравнивайте объекты.',
		focusAll: 'Открыть все →',
		journalHeading: 'Разделы',
		journalLead: 'Регионы, команда и связь — шаг за шагом к следующему этапу.',
		journalReadMore: 'Подробнее →',
		journal: [
			{
				date: 'Регионы',
				title: 'Наш приоритет',
				excerpt:
					'Черногория, Кипр, Турция, Грузия, Бали и Таиланд — одна точка входа ко всем предложениям.',
			},
			{
				date: 'О нас',
				title: 'Prime Realty',
				excerpt:
					'Кто мы и как поддерживаем вас от ориентации на рынке до успешного закрытия сделки.',
			},
			{
				date: 'Контакт',
				title: 'Связаться',
				excerpt:
					'Доступность, языки и практические шаги — ответ без лишних формальностей.',
			},
		],
		pillarsHeading: 'Как мы работаем',
		pillars: [
			{
				title: 'Кураторский подбор',
				text: 'Качество важнее масштаба — объект и данные можно доверять.',
			},
			{
				title: 'Советы и языки',
				text: 'Команда, которая говорит на разных языках и знает местные правила игры.',
			},
			{
				title: 'Сделка «под ключ»',
				text: 'Сопровождение от первого отбора до подписания и после.',
			},
		],
		regionsHeading: 'Регионы',
		regionsLead: 'Быстрый переход к спискам — фильтруйте и сравнивайте параметры объектов.',
		regionsAll: 'Весь каталог с фильтрами →',
		stayHeading: 'Будьте в контексте',
		stayLead: 'Обновления по объектам и консультации — оперативно отвечаем на запросы.',
		stayContact: 'Написать',
		stayAbout: 'О Prime Realty',
	},
	zh: {
		title: 'Prime Realty · 高端房产',
		metaDescription:
			'黑山、塞浦路斯、北塞浦路斯、土耳其、格鲁吉亚、巴厘岛及泰国等区域的高端在售物业。',
		heroEyebrow: 'Prime Realty · 地中海 · 黑海 · 东南亚',
		heroH1: '全球高端房产',
		heroLead:
			'重点区域：黑山、塞浦路斯、北塞浦路斯、土耳其、格鲁吉亚、巴厘岛与泰国——从初次沟通到完成交易。',
		heroBullets: ['精选房源', '专业顾问陪伴', '多语言团队'] as const,
		searchLabel: '搜索房源',
		searchPlaceholder: '城市、关键词、物业类型…',
		searchSubmit: '搜索',
		heroSearchFootnote: '可在上方结合关键词检索——匹配的房源会同步显示在地图与列表中。',
		ctaPrimary: '浏览房源',
		ctaSecondary: '提交咨询',
		spotlightHeading: '甄选推荐',
		spotlightLead: '不同海岸线与建筑风格——欢迎查看在售目录中的全部条目。',
		spotlightAllLink: '全部房源 →',
		spotlight: [
			{ title: '亚得里亚海岸线', location: '黑山', price: '欢迎询价' },
			{ title: '地中海之滨', location: '塞浦路斯', price: '欢迎询价' },
			{ title: '海岸与高尔夫球场', location: '北塞浦路斯', price: '欢迎询价' },
			{ title: '海岸线与都市圈', location: '土耳其', price: '欢迎询价' },
			{ title: '黑海与高加索', location: '格鲁吉亚', price: '欢迎询价' },
			{ title: '热带别墅', location: '巴厘岛', price: '欢迎询价' },
			{ title: '海岛与海岸线', location: '泰国', price: '欢迎询价' },
		],
		categoryLabel: '精选合集',
		categoryH2: '在售房源',
		categoryLead:
			'从公寓到度假村物业——横跨地中海、黑海及东南亚航线，我们以清晰信息与可联系的服务支持你。',
		categoryCta: '浏览房源目录 →',
		focusHeading: '当前主推',
		focusLead: '最新上线的楼盘与别墅，欢迎进一步了解。',
		focusAll: '查看全部 →',
		journalHeading: '导览',
		journalLead: '区域划分、团队与联络方式——为下一步作好准备。',
		journalReadMore: '查看更多 →',
		journal: [
			{
				date: '区域',
				title: '我们聚焦的市场',
				excerpt:
					'从黑山、塞浦路斯、土耳其再到格鲁吉亚、巴厘岛与泰国，一站浏览相关房源。',
			},
			{
				date: '介绍',
				title: 'Prime Realty',
				excerpt:
					'我们如何陪伴你从初步筛选到现场尽调以至顺利成交。',
			},
			{
				date: '联系',
				title: '开始沟通',
				excerpt:
					'可用的沟通语言与后续步骤——直接、务实的协助。',
			},
		],
		pillarsHeading: '工作方式',
		pillars: [
			{
				title: '精选目录',
				text: '以可靠信息呈现的少量优质资产。',
			},
			{
				title: '顾问与多语言支持',
				text: '服务跨境买家的专业团队协作。',
			},
			{
				title: '流程与收口',
				text: '自早期比价到交房后的持续答疑。',
			},
		],
		regionsHeading: '热门目的地',
		regionsLead: '直接进入列表并使用筛选进行对比。',
		regionsAll: '浏览完整房源一览 →',
		stayHeading: '保持知情',
		stayLead: '楼盘更新与支持——我们会尽快回复你的咨询。',
		stayContact: '联系我们',
		stayAbout: '关于 Prime Realty',
	},
};

export const regions = ['Montenegro', 'Zypern', 'Nordzypern', 'Türkei', 'Georgien', 'Bali', 'Thailand'] as const;
export const regionsEn = ['Montenegro', 'Cyprus', 'Northern Cyprus', 'Turkey', 'Georgia', 'Bali', 'Thailand'] as const;
export const regionsRu = [
	'Черногория',
	'Кипр',
	'Северный Кипр',
	'Турция',
	'Грузия',
	'Бали',
	'Таиланд',
] as const;
export const regionsZh = ['黑山', '塞浦路斯', '北塞浦路斯', '土耳其', '格鲁吉亚', '巴厘岛', '泰国'] as const;
