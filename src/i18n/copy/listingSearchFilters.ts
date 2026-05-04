import type { ListingBrowseFilters, ListingBrowseSortKey } from '../../lib/listingsQuery';
import type { Locale } from '../locale';

export type ListingSearchFiltersCopy = {
	keywordLegend: string;
	countryLegend: string;
	typeLegend: string;
	priceLegend: string;
	priceMinLegend: string;
	sortLegend: string;
	sortOptions: readonly { value: ListingBrowseSortKey; label: string }[];
	bedroomsLegend: string;
	bedroomsOptions: readonly { value: string; label: string }[];
	cityLegend: string;
	featuredLegend: string;
	search: string;
	countries: readonly { slug: ListingBrowseFilters['countrySlug']; label: string }[];
	types: readonly { slug: ListingBrowseFilters['propertyTypeSlug']; label: string }[];
	prices: readonly { value: string; label: string }[];
};

export const listingSearchFiltersUi: Record<Locale, ListingSearchFiltersCopy> = {
	de: {
		keywordLegend: 'Suchbegriff (optional)',
		countryLegend: 'Land',
		typeLegend: 'Typ',
		priceLegend: 'Max. Preis',
		priceMinLegend: 'Min. Preis (EUR)',
		sortLegend: 'Sortierung',
		sortOptions: [
			{ value: 'created_desc', label: 'Neueste zuerst' },
			{ value: 'created_asc', label: 'Älteste zuerst' },
			{ value: 'price_asc', label: 'Preis aufsteigend' },
			{ value: 'price_desc', label: 'Preis absteigend' },
		],
		bedroomsLegend: 'Mind. Zimmer',
		bedroomsOptions: [
			{ value: '', label: 'egal' },
			{ value: '1', label: '1+' },
			{ value: '2', label: '2+' },
			{ value: '3', label: '3+' },
			{ value: '4', label: '4+' },
			{ value: '5', label: '5+' },
		],
		cityLegend: 'Ort (enthält)',
		featuredLegend: 'Nur Featured',
		search: 'Suchen',
		countries: [
			{ slug: '', label: 'Alle Länder' },
			{ slug: 'montenegro', label: 'Montenegro' },
			{ slug: 'cyprus', label: 'Zypern (Rep.)' },
			{ slug: 'north-cyprus', label: 'Nordzypern' },
			{ slug: 'turkey', label: 'Türkei' },
			{ slug: 'georgia', label: 'Georgien' },
			{ slug: 'bali', label: 'Bali' },
			{ slug: 'thailand', label: 'Thailand' },
		],
		types: [
			{ slug: '', label: 'Alle Typen' },
			{ slug: 'apartment', label: 'Wohnung · Apartment' },
			{ slug: 'house', label: 'Haus · Chalet' },
			{ slug: 'villa', label: 'Villa' },
			{ slug: 'penthouse', label: 'Penthouse' },
			{ slug: 'plot', label: 'Grundstück · Land' },
			{ slug: 'commercial', label: 'Gewerbe · Investment' },
		],
		prices: [
			{ value: '', label: 'Alle Preise' },
			{ value: '250000', label: 'bis 250.000 €' },
			{ value: '500000', label: 'bis 500.000 €' },
			{ value: '750000', label: 'bis 750.000 €' },
			{ value: '1000000', label: 'bis 1 Mio €' },
			{ value: '2000000', label: 'bis 2 Mio €' },
		],
	},
	en: {
		keywordLegend: 'Keyword (optional)',
		countryLegend: 'Country',
		typeLegend: 'Type',
		priceLegend: 'Max. price',
		priceMinLegend: 'Min. price (EUR)',
		sortLegend: 'Sort',
		sortOptions: [
			{ value: 'created_desc', label: 'Newest first' },
			{ value: 'created_asc', label: 'Oldest first' },
			{ value: 'price_asc', label: 'Price: low to high' },
			{ value: 'price_desc', label: 'Price: high to low' },
		],
		bedroomsLegend: 'Min. bedrooms',
		bedroomsOptions: [
			{ value: '', label: 'Any' },
			{ value: '1', label: '1+' },
			{ value: '2', label: '2+' },
			{ value: '3', label: '3+' },
			{ value: '4', label: '4+' },
			{ value: '5', label: '5+' },
		],
		cityLegend: 'City (contains)',
		featuredLegend: 'Featured only',
		search: 'Search',
		countries: [
			{ slug: '', label: 'All countries' },
			{ slug: 'montenegro', label: 'Montenegro' },
			{ slug: 'cyprus', label: 'Cyprus (Republic)' },
			{ slug: 'north-cyprus', label: 'Northern Cyprus' },
			{ slug: 'turkey', label: 'Turkey' },
			{ slug: 'georgia', label: 'Georgia' },
			{ slug: 'bali', label: 'Bali' },
			{ slug: 'thailand', label: 'Thailand' },
		],
		types: [
			{ slug: '', label: 'All types' },
			{ slug: 'apartment', label: 'Apartment · flat' },
			{ slug: 'house', label: 'House · chalet' },
			{ slug: 'villa', label: 'Villa' },
			{ slug: 'penthouse', label: 'Penthouse' },
			{ slug: 'plot', label: 'Land · plot' },
			{ slug: 'commercial', label: 'Commercial · investment' },
		],
		prices: [
			{ value: '', label: 'Any budget' },
			{ value: '250000', label: 'up to €250,000' },
			{ value: '500000', label: 'up to €500,000' },
			{ value: '750000', label: 'up to €750,000' },
			{ value: '1000000', label: 'up to €1M' },
			{ value: '2000000', label: 'up to €2M' },
		],
	},
	ru: {
		keywordLegend: 'Ключевые слова (необязательно)',
		countryLegend: 'Страна',
		typeLegend: 'Тип',
		priceLegend: 'Максимальная цена',
		priceMinLegend: 'Мин. цена (EUR)',
		sortLegend: 'Сортировка',
		sortOptions: [
			{ value: 'created_desc', label: 'Сначала новые' },
			{ value: 'created_asc', label: 'Сначала старые' },
			{ value: 'price_asc', label: 'Цена по возрастанию' },
			{ value: 'price_desc', label: 'Цена по убыванию' },
		],
		bedroomsLegend: 'Мин. комнат',
		bedroomsOptions: [
			{ value: '', label: 'любое' },
			{ value: '1', label: '1+' },
			{ value: '2', label: '2+' },
			{ value: '3', label: '3+' },
			{ value: '4', label: '4+' },
			{ value: '5', label: '5+' },
		],
		cityLegend: 'Город (содержит)',
		featuredLegend: 'Только избранные',
		search: 'Найти',
		countries: [
			{ slug: '', label: 'Все страны' },
			{ slug: 'montenegro', label: 'Черногория' },
			{ slug: 'cyprus', label: 'Кипр' },
			{ slug: 'north-cyprus', label: 'Северный Кипр' },
			{ slug: 'turkey', label: 'Турция' },
			{ slug: 'georgia', label: 'Грузия' },
			{ slug: 'bali', label: 'Бали' },
			{ slug: 'thailand', label: 'Таиланд' },
		],
		types: [
			{ slug: '', label: 'Любой тип' },
			{ slug: 'apartment', label: 'Апартаменты · квартира' },
			{ slug: 'house', label: 'Дом · шале' },
			{ slug: 'villa', label: 'Вилла' },
			{ slug: 'penthouse', label: 'Пентхаус' },
			{ slug: 'plot', label: 'Участок · земля' },
			{ slug: 'commercial', label: 'Коммерческая · инвестиции' },
		],
		prices: [
			{ value: '', label: 'Любой бюджет' },
			{ value: '250000', label: 'до 250 000 €' },
			{ value: '500000', label: 'до 500 000 €' },
			{ value: '750000', label: 'до 750 000 €' },
			{ value: '1000000', label: 'до 1 млн €' },
			{ value: '2000000', label: 'до 2 млн €' },
		],
	},
	zh: {
		keywordLegend: '关键词（可选）',
		countryLegend: '国家/地区',
		typeLegend: '物业类型',
		priceLegend: '最高总价',
		priceMinLegend: '最低价格（EUR）',
		sortLegend: '排序',
		sortOptions: [
			{ value: 'created_desc', label: '最新优先' },
			{ value: 'created_asc', label: '最早优先' },
			{ value: 'price_asc', label: '价格从低到高' },
			{ value: 'price_desc', label: '价格从高到低' },
		],
		bedroomsLegend: '最少卧室',
		bedroomsOptions: [
			{ value: '', label: '不限' },
			{ value: '1', label: '1+' },
			{ value: '2', label: '2+' },
			{ value: '3', label: '3+' },
			{ value: '4', label: '4+' },
			{ value: '5', label: '5+' },
		],
		cityLegend: '城市（包含）',
		featuredLegend: '仅精选',
		search: '搜索',
		countries: [
			{ slug: '', label: '全部国家' },
			{ slug: 'montenegro', label: '黑山' },
			{ slug: 'cyprus', label: '塞浦路斯' },
			{ slug: 'north-cyprus', label: '北塞浦路斯' },
			{ slug: 'turkey', label: '土耳其' },
			{ slug: 'georgia', label: '格鲁吉亚' },
			{ slug: 'bali', label: '巴厘岛' },
			{ slug: 'thailand', label: '泰国' },
		],
		types: [
			{ slug: '', label: '不限类型' },
			{ slug: 'apartment', label: '公寓' },
			{ slug: 'house', label: '独栋别墅 · Chalet' },
			{ slug: 'villa', label: '海景/度假别墅' },
			{ slug: 'penthouse', label: '顶层复式' },
			{ slug: 'plot', label: '土地 · 建设用地' },
			{ slug: 'commercial', label: '商业 · 投资型' },
		],
		prices: [
			{ value: '', label: '不限预算' },
			{ value: '250000', label: '最高 €250,000' },
			{ value: '500000', label: '最高 €500,000' },
			{ value: '750000', label: '最高 €750,000' },
			{ value: '1000000', label: '最高 €100万' },
			{ value: '2000000', label: '最高 €200万' },
		],
	},
};

export const homeRegionListingSlugs: readonly ListingBrowseFilters['countrySlug'][] = [
	'montenegro',
	'cyprus',
	'north-cyprus',
	'turkey',
	'georgia',
	'bali',
	'thailand',
];
