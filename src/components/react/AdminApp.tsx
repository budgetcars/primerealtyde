import { FirebaseError } from 'firebase/app';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	type User,
} from 'firebase/auth';
import {
	addDoc,
	collection,
	deleteDoc,
	type DocumentData,
	doc,
	getDoc,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	startAfter,
	type QueryDocumentSnapshot,
	updateDoc,
	writeBatch,
} from 'firebase/firestore';
import { parseListingsCsv } from '../../lib/csv/parseListingsCsv';
import { deleteXmlListingsNotInExternalIdSet } from '../../lib/firestore/deleteMissingByExternalId';
import { mapExternalIdsToFirestoreDocIds } from '../../lib/firestore/externalIdLookup';
import { detectImportFormat } from '../../lib/import/detectImportFormat';
import { listingInputPassesImportFilters, type ImportRowPresetFilters } from '../../lib/import/importRowFilters';
import { feedUrlSuggestsNorthCyprus } from '../../lib/listingsQuery';
import { withListingBrowseIndex } from '../../lib/listingBrowseIndex';
import { parseOpenImmoXml } from '../../lib/xml/parseOpenImmo';
import { parseAdriomXml } from '../../lib/xml/parseAdriom';
import { stableOpenImmoStagingKey, validateListingXmlImport } from '../../lib/xml/listingXmlImportValidation';
import type { Listing, ListingInput, ListingSource } from '../../lib/types';
import { getDb, getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase/client';
import { fetchXmlFeedViaProxy } from '../../lib/firebase/fetchXmlFeedProxy';
import {
	XmlImportReviewDialog,
	type XmlImportStagingRowAdriom,
	type XmlImportStagingRowOpenImmo,
	type XmlStagingState,
} from './XmlImportReviewDialog';
import { GenericXmlMappingDialog } from './GenericXmlMappingDialog';
import { AdminMarkdownCollectionEditor } from './AdminMarkdownCollectionEditor';
import {
	exportListingsToAdriomListingsXml,
	exportListingsToCsv,
	listingMatchesExportFilter,
	type ListingExportFilter,
} from '../../lib/xml/exportListingsFeed';
import { formatListingPricePrimary } from '../../lib/listingPriceDisplay';

const LISTINGS = 'listings';
/** Firestore erlaubt höchstens 500 Operationen pro Batch-Commit */
const FIRESTORE_BATCH_LIMIT = 500;
const INVENTORY_PAGE_SIZE = 50;

/** Kompakte Icon-Buttons in der Bestands-Tabelle */
const invIconBtn =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40';
const invIconAccent =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50/90 text-amber-950 transition hover:bg-amber-100/90 disabled:opacity-40';
const invIconFeaturedOn =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-400 bg-amber-100 text-amber-950 transition hover:bg-amber-50 disabled:opacity-40';
const invIconDanger =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 transition hover:bg-red-50 disabled:opacity-40';

function Svg16({ children }: { children: ReactNode }) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			{children}
		</svg>
	);
}

function triggerBrowserDownload(contents: string, filename: string, mime: string) {
	const blob = new Blob([contents], { type: mime });
	const u = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = u;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(u), 4000);
}

function firebaseAuthLoginMessage(code: string): string {
	const map: Record<string, string> = {
		'auth/invalid-email': 'Ungültige E-Mail-Adresse.',
		'auth/missing-email': 'Bitte eine E-Mail-Adresse eingeben.',
		'auth/missing-password': 'Bitte ein Passwort eingeben.',
		'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht (oder Nutzer existiert nicht).',
		'auth/invalid-login-credentials': 'E-Mail oder Passwort stimmt nicht.',
		'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
		'auth/user-not-found': 'Es gibt kein Konto mit dieser E-Mail-Adresse.',
		'auth/user-disabled': 'Dieses Konto wurde in Firebase deaktiviert.',
		'auth/too-many-requests': 'Zu viele Fehlversuche. Bitte in einigen Minuten erneut versuchen.',
		'auth/network-request-failed': 'Netzwerkfehler – Verbindung und Firewall/VPN prüfen.',
		'auth/internal-error': 'Firebase-Fehler. Bitte später erneut versuchen.',
		/** Häufigste Ursache, wenn überhaupt kein Login klappt: */
		'auth/operation-not-allowed':
			'E-Mail/Passwort-Anmeldung ist im Firebase-Projekt nicht aktiviert. In der Console unter „Authentication → Sign-in method“ aktivieren.',
		'auth/invalid-api-key':
			'Das öffentliche API-Key-/Projekt-Setup aus den Umgebungsvariablen passt nicht. Bitte Projekt-Web-App-Schlüssel erneut prüfen.',
		'auth/unauthorized-domain':
			'Diese Domain ist nicht für Firebase Auth erlaubt (Authorized domains unter Authentication-Einstellungen).',
		'auth/popup-closed-by-user': 'Das Anmelden wurde abgebrochen.',
	};
	return map[code] ?? `Firebase: ${code.replace(/^auth\//, '').replace(/-/g, ' ')}`;
}

export type AdminAppProps = {
	/** Detailseiten-Pfad mit Sprachpräfix (z. B. `/immobilie`, `/en/immobilie`) für „Ansehen“ */
	listingPreviewBase?: string;
};

function inputCls() {
	return 'mt-1 w-full rounded-xl border border-slate-200/90 bg-white/70 px-4 py-3 text-gray-900 shadow-sm outline-none backdrop-blur-sm transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50';
}

/** Firestore verwirft Felder mit `undefined` */
function omitUndefinedShallow(record: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(record)) {
		if (v !== undefined) out[k] = v;
	}
	return out;
}

function parseOptionalNumber(raw: string): number | null {
	const t = raw.trim();
	if (!t) return null;
	const n = Number(t.replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

/** UI einen Frame zum Zeichnen geben (Ladezustand sichtbar), bevor schwere Sync-Arbeit startet. */
function yieldToUi(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});
}

type AdminTab = 'inventory' | 'manual' | 'xml' | 'blog' | 'texts';

export function AdminApp({ listingPreviewBase = '/immobilie' }: AdminAppProps) {
	const skipped = !isFirebaseConfigured();
	const previewBase = listingPreviewBase.replace(/\/$/, '');

	const [user, setUser] = useState<User | null>(null);
	const [authReady, setAuthReady] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [authError, setAuthError] = useState<string | null>(null);
	const [tab, setTab] = useState<AdminTab>('inventory');
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const [inventory, setInventory] = useState<Listing[]>([]);
	const [inventoryLoading, setInventoryLoading] = useState(false);
	const [inventoryError, setInventoryError] = useState<string | null>(null);
	const [inventoryPage, setInventoryPage] = useState(1);
	const [inventoryHasNextPage, setInventoryHasNextPage] = useState(false);
	const [inventoryNextCursor, setInventoryNextCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
	const [inventoryPageCursors, setInventoryPageCursors] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
	const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(() => new Set());
	const inventorySelectAllRef = useRef<HTMLInputElement>(null);

	const selectableInventoryIds = useMemo(
		() => inventory.map((r) => r.id).filter((x): x is string => Boolean(x)),
		[inventory],
	);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editSource, setEditSource] = useState<ListingSource>('manual');

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [priceEuro, setPriceEuro] = useState('');
	const [pricePerMonthEuro, setPricePerMonthEuro] = useState('');
	const [livingSpaceSqm, setLivingSpaceSqm] = useState('');
	const [rooms, setRooms] = useState('');
	const [propertyType, setPropertyType] = useState('Ferienwohnung');
	const [city, setCity] = useState('');
	const [zip, setZip] = useState('');
	const [street, setStreet] = useState('');
	const [country, setCountry] = useState('');
	const [latitude, setLatitude] = useState('');
	const [longitude, setLongitude] = useState('');
	const [featured, setFeatured] = useState(false);
	const [imageUrls, setImageUrls] = useState('');

	const [xmlText, setXmlText] = useState('');
	const [xmlFeedUrl, setXmlFeedUrl] = useState('https://adriom.me/api/listings.xml');
	const [langPref, setLangPref] = useState<'de' | 'en'>('de');
	const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
	const [xmlStaging, setXmlStaging] = useState<XmlStagingState | null>(null);
	const [xmlStagingLoading, setXmlStagingLoading] = useState(false);
	const [xmlPrepareProgress, setXmlPrepareProgress] = useState<{ done: number; total: number } | null>(null);
	const xmlPrepareCancelledRef = useRef(false);
	const [importFilterMinPrice, setImportFilterMinPrice] = useState('');
	const [importFilterMaxPrice, setImportFilterMaxPrice] = useState('');
	const [importFilterCity, setImportFilterCity] = useState('');
	const [importFilterCountry, setImportFilterCountry] = useState('');
	const [importFilterFeaturedOnly, setImportFilterFeaturedOnly] = useState(false);
	const [importFilterRequireImages, setImportFilterRequireImages] = useState(false);
	const [csvDocIdColumn, setCsvDocIdColumn] = useState(false);
	const [openImmoMergeByExternalId, setOpenImmoMergeByExternalId] = useState(false);
	const [importDeleteMissingByExternalId, setImportDeleteMissingByExternalId] = useState(false);
	const [importDeleteMissingFeedScope, setImportDeleteMissingFeedScope] = useState('');
	const [importFeedLabel, setImportFeedLabel] = useState('');
	const [genericXmlMapOpen, setGenericXmlMapOpen] = useState(false);
	const [xmlExportPreset, setXmlExportPreset] = useState<'all' | 'featured' | 'manual' | 'adriom' | 'xml'>('all');
	const [xmlExportCountry, setXmlExportCountry] = useState('');

	const loadInventory = useCallback(async (opts?: {
		page?: number;
		cursor?: QueryDocumentSnapshot<DocumentData> | null;
		cursors?: (QueryDocumentSnapshot<DocumentData> | null)[];
	}) => {
		if (skipped) return;
		const db = getDb();
		const page = opts?.page ?? 1;
		const cursor = opts?.cursor ?? null;
		const cursors = opts?.cursors ?? [null];
		setInventoryError(null);
		setInventoryLoading(true);
		try {
			const constraints = [orderBy('title'), limit(INVENTORY_PAGE_SIZE + 1)];
			if (cursor) constraints.push(startAfter(cursor));
			const snap = await getDocs(query(collection(db, LISTINGS), ...constraints));
			const docs = snap.docs;
			const pageDocs = docs.slice(0, INVENTORY_PAGE_SIZE);
			const rows: Listing[] = [];
			pageDocs.forEach((d) => {
				rows.push({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) });
			});
			setInventory(rows);
			const hasNext = docs.length > INVENTORY_PAGE_SIZE;
			setInventoryHasNextPage(hasNext);
			setInventoryNextCursor(hasNext ? pageDocs[pageDocs.length - 1] ?? null : null);
			setInventoryPage(page);
			setInventoryPageCursors(cursors);
		} catch (e: unknown) {
			setInventoryError(e instanceof Error ? e.message : 'Bestand konnte nicht geladen werden');
		} finally {
			setInventoryLoading(false);
		}
	}, [skipped]);

	const reloadInventoryPage = useCallback(async () => {
		const cursor = inventoryPageCursors[inventoryPage - 1] ?? null;
		await loadInventory({
			page: inventoryPage,
			cursor,
			cursors: inventoryPageCursors,
		});
	}, [inventoryPage, inventoryPageCursors, loadInventory]);

	async function goInventoryNextPage() {
		if (busy || inventoryLoading || !inventoryHasNextPage || !inventoryNextCursor) return;
		const nextPage = inventoryPage + 1;
		const nextCursors = [...inventoryPageCursors];
		nextCursors[nextPage - 1] = inventoryNextCursor;
		await loadInventory({
			page: nextPage,
			cursor: inventoryNextCursor,
			cursors: nextCursors,
		});
	}

	async function goInventoryPrevPage() {
		if (busy || inventoryLoading || inventoryPage <= 1) return;
		const prevPage = inventoryPage - 1;
		const prevCursor = inventoryPageCursors[prevPage - 1] ?? null;
		await loadInventory({
			page: prevPage,
			cursor: prevCursor,
			cursors: inventoryPageCursors.slice(0, prevPage),
		});
	}

	useEffect(() => {
		if (skipped) return;
		const auth = getFirebaseAuth();
		return onAuthStateChanged(auth, (u) => {
			setUser(u);
			setAuthReady(true);
		});
	}, [skipped]);

	useEffect(() => {
		if (skipped || !user) return;
		void loadInventory({ page: 1, cursor: null, cursors: [null] });
	}, [skipped, user, loadInventory]);

	useEffect(() => {
		setSelectedListingIds((prev) => {
			const valid = new Set(selectableInventoryIds);
			let changed = false;
			const next = new Set<string>();
			for (const id of prev) {
				if (valid.has(id)) next.add(id);
				else changed = true;
			}
			return changed ? next : prev;
		});
	}, [selectableInventoryIds]);

	useEffect(() => {
		const el = inventorySelectAllRef.current;
		if (!el) return;
		const n = selectableInventoryIds.length;
		const c = selectableInventoryIds.filter((id) => selectedListingIds.has(id)).length;
		el.indeterminate = n > 0 && c > 0 && c < n;
	}, [selectableInventoryIds, selectedListingIds]);

	function toggleListingSelected(id: string) {
		if (!id) return;
		setSelectedListingIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleSelectAllInventory() {
		const allOn =
			selectableInventoryIds.length > 0 &&
			selectableInventoryIds.every((id) => selectedListingIds.has(id));
		setSelectedListingIds(allOn ? new Set() : new Set(selectableInventoryIds));
	}

	function clearManualForm() {
		setEditingId(null);
		setEditSource('manual');
		setTitle('');
		setDescription('');
		setPriceEuro('');
		setPricePerMonthEuro('');
		setLivingSpaceSqm('');
		setRooms('');
		setPropertyType('Ferienwohnung');
		setCity('');
		setZip('');
		setStreet('');
		setCountry('');
		setLatitude('');
		setLongitude('');
		setFeatured(false);
		setImageUrls('');
	}

	function populateFromListing(l: Listing) {
		setEditingId(l.id ?? null);
		setEditSource(l.source ?? 'manual');
		setTitle(l.title ?? '');
		setDescription(l.description ?? '');
		setPriceEuro(l.priceEuro != null ? String(l.priceEuro) : '');
		setPricePerMonthEuro(l.pricePerMonthEuro != null ? String(l.pricePerMonthEuro) : '');
		setLivingSpaceSqm(l.livingSpaceSqm != null ? String(l.livingSpaceSqm) : '');
		setRooms(l.rooms != null ? String(l.rooms) : '');
		setPropertyType(l.propertyType || 'Immobilie');
		setCity(l.city ?? '');
		setZip(l.zip ?? '');
		setStreet(l.street ?? '');
		setCountry(l.country ?? '');
		setLatitude(l.latitude != null && !Number.isNaN(l.latitude) ? String(l.latitude) : '');
		setLongitude(l.longitude != null && !Number.isNaN(l.longitude) ? String(l.longitude) : '');
		setFeatured(Boolean(l.featured));
		setImageUrls((l.images ?? []).join('\n'));
		setTab('manual');
		setStatus(null);
	}

	function buildPayload(): ListingInput {
		const images = imageUrls
			.split(/[\n,]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		const lat = parseOptionalNumber(latitude);
		const lon = parseOptionalNumber(longitude);
		return {
			title: title.trim() || 'Ohne Titel',
			description: description.trim(),
			priceEuro: priceEuro.trim() ? Number(priceEuro.replace(',', '.')) : null,
			pricePerMonthEuro: pricePerMonthEuro.trim() ? Number(pricePerMonthEuro.replace(',', '.')) : null,
			livingSpaceSqm: livingSpaceSqm.trim() ? Number(livingSpaceSqm.replace(',', '.')) : null,
			rooms: rooms.trim() ? Number(rooms.replace(',', '.')) : null,
			propertyType: propertyType.trim() || 'Immobilie',
			city: city.trim(),
			zip: zip.trim(),
			street: street.trim(),
			images,
			source: editingId ? editSource : 'manual',
			country: country.trim(),
			latitude: lat,
			longitude: lon,
			featured,
		};
	}

	async function login(ev: FormEvent) {
		ev.preventDefault();
		setAuthError(null);
		setBusy(true);
		try {
			await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
		} catch (e: unknown) {
			if (e instanceof FirebaseError) {
				setAuthError(firebaseAuthLoginMessage(e.code));
				return;
			}
			const msg = e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen';
			setAuthError(msg);
		} finally {
			setBusy(false);
		}
	}

	async function logout() {
		await signOut(getFirebaseAuth());
	}

	async function submitManual(ev: FormEvent) {
		ev.preventDefault();
		setStatus(null);
		setBusy(true);
		try {
			const payloadBase = buildPayload();
			const existing = editingId ? inventory.find((r) => r.id === editingId) : undefined;
			const payload = withListingBrowseIndex({
				...payloadBase,
				createdAt: existing?.createdAt,
			} as Record<string, unknown>);
			const db = getDb();

			if (editingId) {
				const ref = doc(db, LISTINGS, editingId);
				await updateDoc(ref, omitUndefinedShallow(payload as unknown as Record<string, unknown>));
				setStatus('Objekt wurde aktualisiert.');
			} else {
				await addDoc(collection(db, LISTINGS), {
					...omitUndefinedShallow(payload as unknown as Record<string, unknown>),
					createdAt: serverTimestamp(),
				});
				setStatus('Objekt wurde gespeichert.');
			}

			clearManualForm();
			await reloadInventoryPage();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function removeListing(id: string, label: string) {
		if (!window.confirm(`„${label}“ wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`)) return;
		setStatus(null);
		setBusy(true);
		try {
			await deleteDoc(doc(getDb(), LISTINGS, id));
			setStatus('Eintrag gelöscht.');
			if (editingId === id) clearManualForm();
			await reloadInventoryPage();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function toggleFeatured(id: string, current: boolean | undefined) {
		setBusy(true);
		try {
			await updateDoc(doc(getDb(), LISTINGS, id), { featured: !current });
			await reloadInventoryPage();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Änderung fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function bulkSetFeaturedSelection(featuredValue: boolean) {
		const ids = Array.from(selectedListingIds);
		if (!ids.length || busy) return;
		setStatus(null);
		setBusy(true);
		try {
			const db = getDb();
			for (let i = 0; i < ids.length; i += FIRESTORE_BATCH_LIMIT) {
				const chunk = ids.slice(i, i + FIRESTORE_BATCH_LIMIT);
				const batch = writeBatch(db);
				for (const id of chunk) {
					batch.update(doc(db, LISTINGS, id), { featured: featuredValue });
				}
				await batch.commit();
			}
			setStatus(
				featuredValue
					? `${ids.length} Objekt(e) als Featured markiert.`
					: `Featured bei ${ids.length} Objekt(en) entfernt.`,
			);
			await reloadInventoryPage();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Featured-Änderung fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function bulkDeleteSelection() {
		const ids = Array.from(selectedListingIds);
		if (!ids.length || busy) return;
		if (
			!window.confirm(
				`${ids.length} ausgewählte Objekt(e) wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`,
			)
		) {
			return;
		}
		setStatus(null);
		setBusy(true);
		try {
			const db = getDb();
			for (let i = 0; i < ids.length; i += FIRESTORE_BATCH_LIMIT) {
				const chunk = ids.slice(i, i + FIRESTORE_BATCH_LIMIT);
				const batch = writeBatch(db);
				for (const id of chunk) {
					batch.delete(doc(db, LISTINGS, id));
				}
				await batch.commit();
			}
			if (editingId && ids.includes(editingId)) clearManualForm();
			setSelectedListingIds(new Set());
			setStatus(`${ids.length} Eintrag/Einträge gelöscht.`);
			await reloadInventoryPage();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function loadXmlFromUrl() {
		setStatus(null);
		setBusy(true);
		const url = xmlFeedUrl.trim();
		try {
			let text: string;
			let viaProxy = false;
			try {
				const res = await fetch(url, { mode: 'cors' });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				text = await res.text();
			} catch (directErr: unknown) {
				if (!user) throw directErr;
				try {
					const proxied = await fetchXmlFeedViaProxy(url);
					text = proxied.body;
					viaProxy = true;
				} catch (proxyErr: unknown) {
					const d = directErr instanceof Error ? directErr.message : String(directErr);
					const p = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
					throw new Error(`Direktabruf: ${d} — Feed-Proxy: ${p}`);
				}
			}
			setXmlText(text);
			const via = viaProxy ? ' (serverseitig, ohne CORS)' : '';
			setStatus(
				`Daten geladen${via} (${text.length.toLocaleString('de-DE')} Zeichen). Anschließend „Analysieren & Vorschau“ ausführen.`,
			);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Laden fehlgeschlagen';
			const hint =
				user && msg.toLowerCase().includes('failed to fetch')
					? ' Falls der Feed-Proxy noch nicht deployed ist: im Projektordner `firebase deploy --only functions` (Blaze-Tarif für externe Abrufe). '
					: ' ';
			setStatus(
				`${msg}.${hint}Alternativ: Inhalt manuell einfügen oder XML-Datei vom Rechner wählen.`,
			);
		} finally {
			setBusy(false);
		}
	}

	function closeXmlImportDialog() {
		if (busy) return;
		xmlPrepareCancelledRef.current = true;
		setXmlDialogOpen(false);
		setXmlStaging(null);
		setXmlStagingLoading(false);
		setXmlPrepareProgress(null);
	}

	const XML_PREPARE_CHUNK = 80;

	function currentImportRowFilters(): ImportRowPresetFilters {
		return {
			minPriceEuro: parseOptionalNumber(importFilterMinPrice),
			maxPriceEuro: parseOptionalNumber(importFilterMaxPrice),
			cityContains: importFilterCity,
			countryContains: importFilterCountry,
			featuredOnly: importFilterFeaturedOnly,
			requireImages: importFilterRequireImages,
		};
	}

	function handleGenericXmlMapped(listings: ListingInput[]) {
		setGenericXmlMapOpen(false);
		xmlPrepareCancelledRef.current = false;
		setXmlStaging(null);
		setXmlDialogOpen(true);
		setXmlStagingLoading(true);
		setXmlPrepareProgress(null);
		void (async () => {
			await yieldToUi();
			try {
				const rowFilter = currentImportRowFilters();
				const filtered = listings.filter((p) => listingInputPassesImportFilters(p, rowFilter));
				if (!filtered.length) {
					setStatus('Nach Import-Filtern blieben keine Einträge aus dem Feld-Mapping übrig.');
					setXmlDialogOpen(false);
					setXmlStagingLoading(false);
					return;
				}

				const rows: XmlImportStagingRowOpenImmo[] = [];
				for (let start = 0; start < filtered.length; start += XML_PREPARE_CHUNK) {
					if (xmlPrepareCancelledRef.current) {
						setXmlStagingLoading(false);
						setXmlPrepareProgress(null);
						return;
					}
					const end = Math.min(start + XML_PREPARE_CHUNK, filtered.length);
					for (let idx = start; idx < end; idx++) {
						const listing = filtered[idx]!;
						const v = validateListingXmlImport(listing, { kind: 'openimmo', rowIndex: idx });
						rows.push({
							format: 'openimmo' as const,
							rowKey: `generic-xml-${stableOpenImmoStagingKey(idx, listing)}`,
							checked: v.errors.length === 0,
							errors: v.errors,
							warnings: v.warnings,
							listing,
						});
					}
					setXmlPrepareProgress({ done: end, total: filtered.length });
					await new Promise<void>((resolve) => {
						queueMicrotask(() => setTimeout(resolve, 0));
					});
				}

				if (xmlPrepareCancelledRef.current) {
					setXmlStagingLoading(false);
					setXmlPrepareProgress(null);
					return;
				}

				setXmlStaging({ format: 'openimmo', source: 'generic-xml', rows });
				const withErrors = rows.filter((r) => r.errors.length > 0).length;
				setStatus(
					`Vorschau (eigenes XML): ${rows.length.toLocaleString('de-DE')} Datensatz/Datensätze${withErrors ? ` — ${withErrors} mit Meldungen` : ''}.`,
				);
			} catch (e: unknown) {
				setStatus(e instanceof Error ? e.message : 'Aufbereitung nach Mapping fehlgeschlagen.');
				setXmlDialogOpen(false);
			} finally {
				setXmlStagingLoading(false);
				setXmlPrepareProgress(null);
			}
		})();
	}

	function analyzeXmlStaging() {
		setStatus(null);
		const raw = xmlText.trim();
		if (!raw) {
			setStatus('Bitte Inhalt einfügen oder per URL laden.');
			return;
		}

		xmlPrepareCancelledRef.current = false;

		const kindEarly = detectImportFormat(raw);
		if (kindEarly === 'unknown' && raw.trimStart().startsWith('<')) {
			setGenericXmlMapOpen(true);
			setStatus('Eigenes XML: Feldzuordnung öffnen, Datensatz-Knoten wählen und Felder zuordnen.');
			return;
		}

		setXmlStaging(null);
		setXmlDialogOpen(true);
		setXmlStagingLoading(true);
		setXmlPrepareProgress(null);

		void (async () => {
			await yieldToUi();
			try {
				const kind = detectImportFormat(raw);
				const langs = langPref === 'de' ? ['de', 'en', 'sr', 'ru'] : ['en', 'de', 'sr', 'ru'];
				const rowFilter = currentImportRowFilters();

				if (kind === 'unknown') {
					setStatus(
						'Kein gültiges tabellarisches Format – erwarte eine CSV mit Kopfzeile wie beim Export oder ein erkanntes/Wurzel-XML.',
					);
					setXmlDialogOpen(false);
					setXmlStagingLoading(false);
					return;
				}

				await yieldToUi();

				if (kind === 'listings') {
					const { feedMeta, items } = parseAdriomXml(raw, langs);
					if (xmlPrepareCancelledRef.current) return;
					if (!items.length) {
						setStatus('Keine Einträge in der geladenen Liste erkannt.');
						setXmlDialogOpen(false);
						setXmlStagingLoading(false);
						return;
					}

					const itemsFiltered = items.filter((it) => listingInputPassesImportFilters(it, rowFilter));
					if (!itemsFiltered.length) {
						setStatus('Nach Import-Filtern blieben keine Adriom-Einträge übrig.');
						setXmlDialogOpen(false);
						setXmlStagingLoading(false);
						return;
					}

					const rows: XmlImportStagingRowAdriom[] = [];
					for (let start = 0; start < itemsFiltered.length; start += XML_PREPARE_CHUNK) {
						if (xmlPrepareCancelledRef.current) {
							setXmlStagingLoading(false);
							setXmlPrepareProgress(null);
							return;
						}
						const end = Math.min(start + XML_PREPARE_CHUNK, itemsFiltered.length);
						for (let idx = start; idx < end; idx++) {
							const it = itemsFiltered[idx]!;
							const v = validateListingXmlImport(it, { kind: 'adriom', docId: it.firestoreDocumentId });
							rows.push({
								format: 'adriom' as const,
								rowKey: `adriom-${idx}-${it.firestoreDocumentId}`,
								checked: v.errors.length === 0,
								errors: v.errors,
								warnings: v.warnings,
								payload: it,
							});
						}
						setXmlPrepareProgress({ done: end, total: itemsFiltered.length });
						await new Promise<void>((resolve) => {
							queueMicrotask(() => setTimeout(resolve, 0));
						});
					}

					if (xmlPrepareCancelledRef.current) {
						setXmlStagingLoading(false);
						setXmlPrepareProgress(null);
						return;
					}

					setXmlStaging({ format: 'adriom', feedMeta, rows });
					const withErrors = rows.filter((r) => r.errors.length > 0).length;
					setStatus(
						`Vorschau: ${rows.length.toLocaleString('de-DE')} Eintrag/Einträge (nach Filter von ${items.length.toLocaleString('de-DE')})${withErrors ? ` — ${withErrors} mit kritischen Meldungen` : ''}.`,
					);
				} else if (kind === 'openimmo') {
					const parsed = parseOpenImmoXml(raw);
					if (xmlPrepareCancelledRef.current) return;
					if (!parsed.length) {
						setStatus('Keine Immobilien in den Daten gefunden.');
						setXmlDialogOpen(false);
						setXmlStagingLoading(false);
						return;
					}

					const filtered = parsed.filter((p) => listingInputPassesImportFilters(p, rowFilter));
					if (!filtered.length) {
						setStatus('Nach Import-Filtern blieben keine OpenImmo-Einträge übrig.');
						setXmlDialogOpen(false);
						setXmlStagingLoading(false);
						return;
					}

					const rows: XmlImportStagingRowOpenImmo[] = [];
					for (let start = 0; start < filtered.length; start += XML_PREPARE_CHUNK) {
						if (xmlPrepareCancelledRef.current) {
							setXmlStagingLoading(false);
							setXmlPrepareProgress(null);
							return;
						}
						const end = Math.min(start + XML_PREPARE_CHUNK, filtered.length);
						for (let idx = start; idx < end; idx++) {
							const listing = filtered[idx]!;
							const v = validateListingXmlImport(listing, { kind: 'openimmo', rowIndex: idx });
							rows.push({
								format: 'openimmo' as const,
								rowKey: stableOpenImmoStagingKey(idx, listing),
								checked: v.errors.length === 0,
								errors: v.errors,
								warnings: v.warnings,
								listing,
							});
						}
						setXmlPrepareProgress({ done: end, total: filtered.length });
						await new Promise<void>((resolve) => {
							queueMicrotask(() => setTimeout(resolve, 0));
						});
					}

					if (xmlPrepareCancelledRef.current) {
						setXmlStagingLoading(false);
						setXmlPrepareProgress(null);
						return;
					}

					setXmlStaging({ format: 'openimmo', source: 'openimmo-xml', rows });
					const withErrors = rows.filter((r) => r.errors.length > 0).length;
					setStatus(
						`Vorschau: ${rows.length.toLocaleString('de-DE')} Eintrag/Einträge (nach Filter von ${parsed.length.toLocaleString('de-DE')})${withErrors ? ` — ${withErrors} mit kritischen Meldungen` : ''}.`,
					);
				} else if (kind === 'csv') {
					const csvRows = parseListingsCsv(raw, { docIdColumn: csvDocIdColumn ? 'id' : 'none' });
					if (xmlPrepareCancelledRef.current) return;
					if (!csvRows.length) {
						setStatus('CSV: keine Datenzeilen (erste Zeile = Spaltennamen, siehe Export-CSV).');
						setXmlDialogOpen(false);
						setXmlStagingLoading(false);
						return;
					}

					const itemsFiltered = csvRows.filter((it) => listingInputPassesImportFilters(it, rowFilter));
					if (!itemsFiltered.length) {
						setStatus('Nach Import-Filtern blieben keine CSV-Zeilen übrig.');
						setXmlDialogOpen(false);
						setXmlStagingLoading(false);
						return;
					}

					const nowIso = new Date().toISOString();
					if (csvDocIdColumn) {
						const rows: XmlImportStagingRowAdriom[] = [];
						for (let start = 0; start < itemsFiltered.length; start += XML_PREPARE_CHUNK) {
							if (xmlPrepareCancelledRef.current) {
								setXmlStagingLoading(false);
								setXmlPrepareProgress(null);
								return;
							}
							const end = Math.min(start + XML_PREPARE_CHUNK, itemsFiltered.length);
							for (let idx = start; idx < end; idx++) {
								const row = itemsFiltered[idx]!;
								const docId = row.firestoreDocumentId?.trim() ?? '';
								if (!docId) {
									const v = validateListingXmlImport(row, {
										kind: 'adriom',
										docId: '',
									});
									const errCsv = [
										'CSV: Bei aktivierter Option „Spalte id = Firestore‑ID“ muss „id“ je Zeile gefüllt sein.',
										...v.errors,
									];
									rows.push({
										format: 'adriom' as const,
										rowKey: `csv-${idx}-no-doc`,
										checked: false,
										errors: errCsv,
										warnings: v.warnings,
										payload: { ...row, firestoreDocumentId: '__MISSING_ID__', title: row.title || 'Ohne Zeilen-ID' },
									});
									continue;
								}
								const { firestoreDocumentId: _omit, ...rest } = row;
								const payload: ListingInput & { firestoreDocumentId: string } = {
									...rest,
									firestoreDocumentId: docId,
								};
								const v = validateListingXmlImport(payload, { kind: 'adriom', docId });
								rows.push({
									format: 'adriom' as const,
									rowKey: `csv-${idx}-${docId}`,
									checked: v.errors.length === 0,
									errors: v.errors,
									warnings: v.warnings,
									payload,
								});
							}
							setXmlPrepareProgress({ done: end, total: itemsFiltered.length });
							await new Promise<void>((resolve) => {
								queueMicrotask(() => setTimeout(resolve, 0));
							});
						}
						if (xmlPrepareCancelledRef.current) {
							setXmlStagingLoading(false);
							setXmlPrepareProgress(null);
							return;
						}
						setXmlStaging({
							format: 'adriom',
							feedMeta: {
								source: 'csv-import',
								generated: nowIso,
								count: String(rows.length),
							},
							rows,
						});
						const withErrors = rows.filter((r) => r.errors.length > 0).length;
						setStatus(
							`Vorschau (CSV): ${rows.length.toLocaleString('de-DE')} Zeilen${withErrors ? ` — ${withErrors} mit Meldungen` : ''}.`,
						);
					} else {
						const rows: XmlImportStagingRowOpenImmo[] = [];
						for (let start = 0; start < itemsFiltered.length; start += XML_PREPARE_CHUNK) {
							if (xmlPrepareCancelledRef.current) {
								setXmlStagingLoading(false);
								setXmlPrepareProgress(null);
								return;
							}
							const end = Math.min(start + XML_PREPARE_CHUNK, itemsFiltered.length);
							for (let idx = start; idx < end; idx++) {
								const row = itemsFiltered[idx]!;
								const { firestoreDocumentId: _fd, ...listing } = row;
								const v = validateListingXmlImport(listing, { kind: 'openimmo', rowIndex: idx });
								rows.push({
									format: 'openimmo' as const,
									rowKey: stableOpenImmoStagingKey(idx, listing),
									checked: v.errors.length === 0,
									errors: v.errors,
									warnings: v.warnings,
									listing,
								});
							}
							setXmlPrepareProgress({ done: end, total: itemsFiltered.length });
							await new Promise<void>((resolve) => {
								queueMicrotask(() => setTimeout(resolve, 0));
							});
						}
						if (xmlPrepareCancelledRef.current) {
							setXmlStagingLoading(false);
							setXmlPrepareProgress(null);
							return;
						}
						setXmlStaging({ format: 'openimmo', source: 'csv', rows });
						const withErrors = rows.filter((r) => r.errors.length > 0).length;
						setStatus(
							`Vorschau (CSV): ${rows.length.toLocaleString('de-DE')} Zeilen${withErrors ? ` — ${withErrors} mit Meldungen` : ''}.`,
						);
					}
				}
			} catch (e: unknown) {
				setStatus(e instanceof Error ? e.message : 'Analyse fehlgeschlagen');
				setXmlDialogOpen(false);
			} finally {
				setXmlStagingLoading(false);
				setXmlPrepareProgress(null);
			}
		})();
	}

	function presetToExportFilter(preset: typeof xmlExportPreset): ListingExportFilter {
		switch (preset) {
			case 'featured':
				return { kind: 'featured' };
			case 'manual':
				return { kind: 'source', value: 'manual' };
			case 'adriom':
				return { kind: 'source', value: 'adriom' };
			case 'xml':
				return { kind: 'source', value: 'xml' };
			default:
				return { kind: 'all' };
		}
	}

	function getFilteredListingsForExport(): Listing[] {
		const base = presetToExportFilter(xmlExportPreset);
		let rows = inventory.filter((r) => listingMatchesExportFilter(r, base));
		const needle = xmlExportCountry.trim();
		if (needle)
			rows = rows.filter((r) => listingMatchesExportFilter(r, { kind: 'countryContains', needle }));
		return rows.filter((r) => r.id?.trim());
	}

	function exportListingsXmlFile() {
		const rows = getFilteredListingsForExport();
		if (!rows.length) {
			setStatus('Export: keine passenden Objekte (Filter oder fehlende Firestore-ID).');
			return;
		}
		const titleLang = langPref === 'en' ? 'en' : 'de';
		const xml = exportListingsToAdriomListingsXml(rows, {
			feedSource: 'prime-realty-firestore-export',
			titleLang,
		});
		const d = new Date().toISOString().slice(0, 10);
		triggerBrowserDownload(xml, `prime-realty-export-${d}.xml`, 'application/xml;charset=utf-8');
		setStatus(`Export: ${rows.length} Objekt(e) als Adriom‑XML heruntergeladen.`);
	}

	function exportListingsCsvFile() {
		const rows = getFilteredListingsForExport();
		if (!rows.length) {
			setStatus('Export: keine passenden Objekte (Filter oder fehlende Firestore-ID).');
			return;
		}
		const csv = exportListingsToCsv(rows);
		const d = new Date().toISOString().slice(0, 10);
		triggerBrowserDownload(csv, `prime-realty-export-${d}.csv`, 'text/csv;charset=utf-8');
		setStatus(`Export: ${rows.length} Zeile(n) als CSV heruntergeladen.`);
	}

	function toggleXmlStagingRow(rowKey: string, checked: boolean) {
		setXmlStaging((prev) =>
			prev ? { ...prev, rows: prev.rows.map((r) => (r.rowKey === rowKey ? { ...r, checked } : r)) } : null,
		);
	}

	function selectOnlyValidXmlRows() {
		setXmlStaging((prev) =>
			prev
				? {
						...prev,
						rows: prev.rows.map((r) => ({ ...r, checked: r.errors.length === 0 })),
					}
				: null,
		);
	}

	function deselectAllXmlRows() {
		setXmlStaging((prev) =>
			prev ? { ...prev, rows: prev.rows.map((r) => ({ ...r, checked: false })) } : null,
		);
	}

	async function commitXmlStaging() {
		if (!xmlStaging) return;

		let adSlice: (ListingInput & { firestoreDocumentId: string })[] | null = null;
		let openImmoListings: ListingInput[] | null = null;
		if (xmlStaging.format === 'adriom') {
			adSlice = xmlStaging.rows
				.filter((r) => r.checked)
				.map((r) => r.payload)
				.filter((it) => {
					const id = it.firestoreDocumentId?.trim();
					return Boolean(id && !id.startsWith('__'));
				});
			if (!adSlice.length) {
				setStatus('Keine Objekte ausgewählt (oder nur ungültige/Platzhalter-Dokument-IDs).');
				return;
			}
		} else {
			openImmoListings = xmlStaging.rows.filter((r) => r.checked).map((r) => r.listing);
			if (!openImmoListings.length) {
				setStatus('Keine Objekte ausgewählt.');
				return;
			}
		}

		setBusy(true);
		setStatus(null);
		try {
			const db = getDb();
			if (adSlice && xmlStaging.format === 'adriom') {
				const chunkSize = 400;
				const feedUrlTrimAd = xmlFeedUrl.trim();
				let upserted = 0;
				for (let i = 0; i < adSlice.length; i += chunkSize) {
					const slice = adSlice.slice(i, i + chunkSize);
					const refs = slice.map((it) => doc(db, LISTINGS, it.firestoreDocumentId));
					const snaps = await Promise.all(refs.map((r) => getDoc(r)));
					const batch = writeBatch(db);
					for (let j = 0; j < slice.length; j++) {
						const row = slice[j]!;
						const exists = snaps[j]!.exists();
						const { firestoreDocumentId: _listingDocId, ...rest } = row;
						const merged = withListingBrowseIndex(rest as Record<string, unknown>);
						batch.set(
							refs[j]!,
							{
								...merged,
								...(feedUrlTrimAd ? { xmlFeedSourceUrl: feedUrlTrimAd } : {}),
								syncedAt: serverTimestamp(),
								...(exists ? {} : { createdAt: serverTimestamp() }),
							},
							{ merge: true },
						);
						upserted++;
					}
					await batch.commit();
				}
				const fm = xmlStaging.feedMeta;
				const meta = fm.generated ? ` (Stand der Quelle: ${fm.generated})` : '';
				setStatus(
					`${upserted} Objekt(e) übernommen${meta}. Bestehende Einträge werden bei erneutem Übernehmen aktualisiert.`,
				);
			} else if (openImmoListings && xmlStaging.format === 'openimmo') {
				const chunkSize = 450;
				const feedLabelNorm = importFeedLabel.trim();
				const feedUrlTrim = xmlFeedUrl.trim();
				const northCyprusFromFeedUrl = feedUrlSuggestsNorthCyprus(feedUrlTrim);
				const externalIds = openImmoListings
					.map((item) => item.externalId?.trim() ?? '')
					.filter((x) => x.length > 0);
				const externalIdToDoc =
					openImmoMergeByExternalId && externalIds.length > 0
						? await mapExternalIdsToFirestoreDocIds(db, LISTINGS, externalIds)
						: new Map<string, string>();
				let updated = 0;
				let inserted = 0;
				for (let i = 0; i < openImmoListings.length; i += chunkSize) {
					const chunk = openImmoListings.slice(i, i + chunkSize);
					const batch = writeBatch(db);
					for (const item of chunk) {
						const ext = item.externalId?.trim();
						const existingFsId =
							openImmoMergeByExternalId && ext ? (externalIdToDoc.get(ext) ?? null) : null;
						const ref = existingFsId ? doc(db, LISTINGS, existingFsId) : doc(collection(db, LISTINGS));
						if (existingFsId) updated++;
						else inserted++;
						const rowForIndex = {
							...item,
							...(feedLabelNorm ? { xmlFeedSource: feedLabelNorm } : {}),
							...(feedUrlTrim ? { xmlFeedSourceUrl: feedUrlTrim } : {}),
							...(northCyprusFromFeedUrl ? { country: 'Northern Cyprus' } : {}),
						};
						const merged = withListingBrowseIndex(rowForIndex as Record<string, unknown>);
						batch.set(
							ref,
							{
								...merged,
								syncedAt: serverTimestamp(),
								...(existingFsId ? {} : { createdAt: serverTimestamp() }),
							},
							{ merge: true },
						);
					}
					await batch.commit();
				}
				let statusMsg =
					openImmoMergeByExternalId
						? `${openImmoListings.length} übernommen (${updated} per „externalId“ aktualisiert, ${inserted} neu angelegt).`
						: `${openImmoListings.length} Objekt(e) übernommen (neue Einträge).`;

				if (importDeleteMissingByExternalId && openImmoMergeByExternalId) {
					const keepIds = new Set(
						openImmoListings.map((li) => li.externalId?.trim() ?? '').filter((x) => x.length > 0),
					);
					const everyHasId = openImmoListings.every((li) => Boolean(li.externalId?.trim()));
					if (!everyHasId || keepIds.size !== openImmoListings.length) {
						statusMsg +=
							' „Fehlende löschen“ übersprungen — jede Zeile braucht eine eindeutige externalId ohne Duplikate.';
					} else {
						const deleted = await deleteXmlListingsNotInExternalIdSet(db, LISTINGS, keepIds, {
							scopeSubstring: importDeleteMissingFeedScope.trim() || undefined,
						});
						if (deleted > 0)
							statusMsg += ` ${deleted.toLocaleString('de-DE')} weiterer Eintrag/Einträge gelöscht (nicht mehr im Import).`;
					}
				}

				setStatus(statusMsg);
				setXmlText('');
			}
			setXmlDialogOpen(false);
			setXmlStaging(null);
		await reloadInventoryPage();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Übernehmen fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	if (skipped) {
		return (
			<div className="rounded-2xl border border-amber-200/85 bg-amber-50/90 px-5 py-6 text-sm leading-relaxed text-amber-950 shadow-sm backdrop-blur-sm md:px-6 md:py-7">
				<p className="font-semibold text-amber-950">Firebase-Umgebung unvollständig</p>
				<p className="mt-3 text-amber-900/95">
					Diese Seite nutzt Firebase Auth und Firestore. Legen Sie in <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-mono">.env</code>{' '}
					(public) diese Variablen an:{' '}
					<code className="font-mono text-xs break-all">
						PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID
					</code>
					. Anschließend Projekt neu bauen/starten und in der Firebase Console mindestens einen Mail/Passwort-User unter Authentication anlegen sowie
					Sicherheitsregeln für die Collections{' '}
					<code className="font-mono text-xs">listings</code>,{' '}
					<code className="font-mono text-xs">blogPosts</code>,{' '}
					<code className="font-mono text-xs">siteTexts</code> setzen.
				</p>
			</div>
		);
	}

	if (!authReady)
		return <div className="h-40 animate-pulse rounded-xl border border-white/60 bg-white/40 backdrop-blur-sm" aria-hidden="true" />;

	if (!user) {
		return (
			<form onSubmit={login} className="glass-panel-soft mx-auto max-w-md px-8 py-10">
				<h2 className="text-xl font-semibold text-gray-900">Admin anmelden</h2>
				<p className="mt-2 text-sm text-slate-600">
					Nur für autorisierte Nutzer. Accounts legen Sie in der Firebase Console unter Authentication an (E-Mail & Passwort).
				</p>
				<label className="mt-6 block text-sm font-medium text-slate-700">
					E-Mail
					<input
						type="email"
						autoComplete="username"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={inputCls()}
						required
					/>
				</label>
				<label className="mt-4 block text-sm font-medium text-slate-700">
					Passwort
					<input
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className={inputCls()}
						required
					/>
				</label>
				{authError ? <p className="mt-4 text-sm text-red-800">{authError}</p> : null}
				<details className="mt-8 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-xs text-slate-600 backdrop-blur-sm open:bg-white/70">
					<summary className="cursor-pointer font-semibold text-slate-800">Problem bei der Anmeldung oder mit dem Zugriff?</summary>
					<ol className="mt-3 list-decimal space-y-2 pl-4 marker:text-slate-500">
						<li>
							<strong>Firebase Console:</strong>{' '}
							„Authentication → Sign-in method → E-Mail / Passwort“ muss <strong>aktiviert</strong> sein.
						</li>
						<li>
							Unter{' '}
							<span className="whitespace-nowrap">„Authentication → Settings → Authorized domains“</span>{' '}
							mindestens <code className="rounded bg-white/85 px-1 font-mono">localhost</code> und Ihre Live-Domain eintragen (zusätzliche Preview-URLs z.&nbsp;B. bei Netlify/Vercel).
						</li>
						<li>
							Unter{' '}
							<span className="whitespace-nowrap">„Authentication → Users“</span> gibt es einen Eintrag für Ihre E-Mail – dort ggf. Passwort zurücksetzen oder neuen Nutzer anlegen.
						</li>
						<li>
							<strong>Firestore-Regeln</strong>: im Repo liegt <code className="font-mono">firestore.rules</code> (Schreiben nur wenn angemeldet). Für Ihr Produktions-Projekt bereitstellen mit{' '}
							<code className="rounded bg-white/90 px-1 font-mono text-[11px]">firebase deploy --only firestore:rules</code>.
						</li>
						<li>
							<strong>Variablen</strong>: alle <code className="font-mono">PUBLIC_FIREBASE_*</code> aus einer Web-App derselben Firebase-Installation kopieren, danach Neu-Build/Nach-Deploy.
						</li>
					</ol>
				</details>
				<button
					type="submit"
					disabled={busy}
					className="mt-6 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-brand-900 transition hover:bg-accent-muted disabled:opacity-50"
				>
					{busy ? '…' : 'Anmelden'}
				</button>
			</form>
		);
	}

	const tabCls = (t: AdminTab) =>
		`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
			tab === t ? 'bg-accent text-brand-900 shadow-sm' : 'text-slate-600 hover:bg-white/50 hover:text-gray-900'
		}`;
	const sideBtn = (t: AdminTab) => `${tabCls(t)} w-full text-left`;

	return (
		<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
			<aside className="glass-panel-soft shrink-0 rounded-2xl p-3 lg:sticky lg:top-28 lg:w-56">
				<nav className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
					<p className="hidden px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">Immobilien</p>
					<button type="button" onClick={() => setTab('inventory')} className={sideBtn('inventory')}>
						Bestand <span className="font-normal opacity-75">({inventory.length})</span>
					</button>
					<button type="button" onClick={() => setTab('manual')} className={sideBtn('manual')}>
						{editingId ? 'Objekt bearbeiten' : 'Manuell'}
					</button>
					<button type="button" onClick={() => setTab('xml')} className={sideBtn('xml')}>
						Feed / XML
					</button>
					<p className="mt-2 hidden px-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">Inhalt</p>
					<button type="button" onClick={() => setTab('blog')} className={sideBtn('blog')}>
						Blog
					</button>
					<button type="button" onClick={() => setTab('texts')} className={sideBtn('texts')}>
						Seitentexte
					</button>
				</nav>
			</aside>

			<div className="min-w-0 flex-1 space-y-8">
				<div className="glass-panel-soft flex flex-wrap items-center justify-between gap-4 px-6 py-4">
					<div>
						<p className="text-sm font-medium text-slate-600">Admin</p>
						<p className="mt-0.5 text-sm text-slate-700">
							Angemeldet als <span className="font-semibold text-gray-900">{user.email}</span>
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={inventoryLoading || busy}
							onClick={() => {
								setSelectedListingIds(new Set());
								void loadInventory({ page: 1, cursor: null, cursors: [null] });
							}}
							className="rounded-lg border border-slate-200/90 bg-white/50 px-4 py-2 text-sm font-semibold text-gray-900 backdrop-blur-sm hover:bg-white/85 disabled:opacity-50"
						>
							{inventoryLoading ? 'Lade …' : 'Bestand aktualisieren'}
						</button>
						<button
							type="button"
							onClick={() => void logout()}
							className="rounded-lg border border-slate-200/90 bg-white/50 px-4 py-2 text-sm font-semibold text-gray-900 backdrop-blur-sm hover:bg-white/80"
						>
							Abmelden
						</button>
					</div>
				</div>

			{status ? (
				<p className="glass-panel-soft px-4 py-3 text-sm font-medium text-slate-800">{status}</p>
			) : null}
			{inventoryError ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
					<p>{inventoryError}</p>
					{(inventoryError.includes('ermission') ||
						inventoryError.toLowerCase().includes('insufficient') ||
						inventoryError.toLowerCase().includes('firestore')) ? (
						<p className="mt-2 text-xs text-red-900/90">
							Falls Sie bereits angemeldet sind: die Firestore-Regeln sind ggf. nicht deployed oder noch strikter eingestellt. Im Projekt-Root sollte zum aktuellen Projekt ausgeführt werden:{' '}
							<code className="rounded bg-white/90 px-1 font-mono text-[11px]">firebase deploy --only firestore:rules</code>
							.
						</p>
					) : null}
				</div>
			) : null}

			{tab === 'inventory' ? (
				<div className="space-y-4">
					<p className="text-sm leading-relaxed text-slate-600">
						Einträge direkt aus der Firestore-Collection{' '}
						<code className="rounded-md bg-white/75 px-1.5 py-0.5 font-mono text-xs">listings</code>.
					</p>
					{selectedListingIds.size > 0 ? (
						<div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
							<p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-700">
								<span className="font-semibold text-gray-900">
									{selectedListingIds.size} ausgewählt
								</span>
								<button
									type="button"
									disabled={busy}
									onClick={() => setSelectedListingIds(new Set())}
									className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
								>
									Auswahl aufheben
								</button>
							</p>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									disabled={busy}
									onClick={() => void bulkSetFeaturedSelection(true)}
									className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
								>
									Featured setzen
								</button>
								<button
									type="button"
									disabled={busy}
									onClick={() => void bulkSetFeaturedSelection(false)}
									className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
								>
									Featured entfernen
								</button>
								<button
									type="button"
									disabled={busy}
									onClick={() => void bulkDeleteSelection()}
									className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
								>
									Ausgewählte löschen
								</button>
							</div>
						</div>
					) : null}
					{inventoryLoading && !inventory.length ? (
						<div className="h-56 animate-pulse rounded-xl border border-white/55 bg-white/35 backdrop-blur-sm" />
					) : inventory.length === 0 ? (
						<p className="glass-panel-soft px-5 py-8 text-center text-sm text-slate-600">Noch keine Objekte – legen Sie welche unter „Manuell“ oder „Feed / XML“ an.</p>
					) : (
						<div className="space-y-3">
							<div className="-mx-1 overflow-x-auto border border-slate-200 bg-white">
								<table className="w-full min-w-[44rem] text-left text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
										<th className="w-px whitespace-nowrap px-2 py-3 text-center" scope="col">
											<input
												ref={inventorySelectAllRef}
												type="checkbox"
												disabled={busy || selectableInventoryIds.length === 0}
												checked={
													selectableInventoryIds.length > 0 &&
													selectableInventoryIds.every((id) => selectedListingIds.has(id))
												}
												onChange={toggleSelectAllInventory}
												className="h-4 w-4 rounded border-slate-300 text-amber-600 accent-amber-600 focus:ring-2 focus:ring-amber-500/40"
												aria-label="Alle Objekte auswählen"
												title="Alle auswählen"
											/>
										</th>
										<th className="px-4 py-3">Titel</th>
										<th className="hidden px-2 py-3 sm:table-cell">Ort</th>
										<th className="px-2 py-3 whitespace-nowrap">Preis</th>
										<th className="px-2 py-3">Quelle</th>
										<th className="px-4 py-3 text-right">Aktionen</th>
										</tr>
									</thead>
									<tbody>
										{inventory.map((row) => {
										const id = row.id ?? '';
										const label = row.title || id || 'Ohne Titel';
										const previewHref = id ? `${previewBase}?id=${encodeURIComponent(id)}` : previewBase;
										return (
											<tr key={id || label} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/60">
												<td className="whitespace-nowrap px-2 py-3 text-center align-middle">
													<input
														type="checkbox"
														disabled={busy || !id}
														checked={Boolean(id && selectedListingIds.has(id))}
														onChange={() => toggleListingSelected(id)}
														className="h-4 w-4 rounded border-slate-300 text-amber-600 accent-amber-600 focus:ring-2 focus:ring-amber-500/40"
														aria-label={`Auswahl „${label}“`}
														title="Auswählen"
													/>
												</td>
												<td className="px-4 py-3">
													<div className="font-medium text-gray-900">{row.title}</div>
													<div className="mt-0.5 text-xs text-slate-500 sm:hidden">{[row.country, row.city].filter(Boolean).join(' · ')}</div>
												</td>
												<td className="hidden px-2 py-3 text-slate-700 sm:table-cell">
													{[row.country, row.city, row.zip].filter(Boolean).join(' · ') || '—'}
												</td>
												<td className="whitespace-nowrap px-2 py-3 font-medium text-slate-800">{formatListingPricePrimary(row, 'de')}</td>
												<td className="max-w-[7rem] truncate px-2 py-3 capitalize text-slate-600">{row.source ?? '—'}</td>
												<td className="px-2 py-3">
													<div className="flex flex-nowrap items-center justify-end gap-1">
														<button
															type="button"
															disabled={busy}
															onClick={() => void toggleFeatured(id, row.featured)}
															className={row.featured ? invIconFeaturedOn : invIconAccent}
															title={row.featured ? 'Featured entfernen' : 'Als Featured markieren'}
															aria-label={row.featured ? 'Featured entfernen' : 'Als Featured markieren'}
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																viewBox="0 0 24 24"
																className="h-4 w-4"
																fill={row.featured ? 'currentColor' : 'none'}
																stroke="currentColor"
																strokeWidth={row.featured ? 0 : 2}
																strokeLinecap="round"
																strokeLinejoin="round"
																aria-hidden
															>
																<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.887a1 1 0 00-1.176 0l-3.976 2.887c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
															</svg>
														</button>
														<a
															href={previewHref}
															target="_blank"
															rel="noopener noreferrer"
															className={invIconBtn}
															title="Ansehen (neues Fenster)"
															aria-label="Ansehen (neues Fenster)"
														>
															<Svg16>
																<>
																	<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
																	<polyline points="15 3 21 3 21 9" />
																	<line x1="10" x2="21" y1="14" y2="3" />
																</>
															</Svg16>
														</a>
														<button
															type="button"
															disabled={busy || !id}
															onClick={() => populateFromListing(row)}
															className={invIconBtn}
															title="Bearbeiten"
															aria-label="Bearbeiten"
														>
															<Svg16>
																<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
																<path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
															</Svg16>
														</button>
														<button
															type="button"
															disabled={busy || !id}
															onClick={() => void removeListing(id, label)}
															className={invIconDanger}
															title="Löschen"
															aria-label="Löschen"
														>
															<Svg16>
																<>
																	<path d="M3 6h18" />
																	<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
																	<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
																</>
															</Svg16>
														</button>
													</div>
												</td>
											</tr>
										);
										})}
									</tbody>
								</table>
							</div>
							<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
								<p>
									Seite {inventoryPage} · max. {INVENTORY_PAGE_SIZE} Einträge
								</p>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => void goInventoryPrevPage()}
										disabled={inventoryLoading || busy || inventoryPage <= 1}
										className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
									>
										Zurück
									</button>
									<button
										type="button"
										onClick={() => void goInventoryNextPage()}
										disabled={inventoryLoading || busy || !inventoryHasNextPage}
										className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
									>
										Weiter
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			) : null}

			{tab === 'manual' ? (
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Objekt bearbeiten' : 'Neues Objekt erfassen'}</h2>
						{(editingId || title || description || imageUrls) && (
							<button
								type="button"
								disabled={busy}
								onClick={() => {
									clearManualForm();
									setStatus(null);
								}}
								className="text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-gray-900"
							>
								Formular zurücksetzen
							</button>
						)}
					</div>

					<form onSubmit={submitManual} className="grid max-w-2xl gap-6">
						<label className="block text-sm font-medium text-slate-700">
							Titel
							<input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls()} required />
						</label>
						<label className="block text-sm font-medium text-slate-700">
							Beschreibung
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={5}
								className={`${inputCls()} resize-y`}
							/>
						</label>
						<label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
							<input
								type="checkbox"
								className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-amber-200"
								checked={featured}
								onChange={(e) => setFeatured(e.target.checked)}
							/>
							Featured (hervorheben auf Karten/Inseraten)
						</label>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block text-sm font-medium text-slate-700">
								Kaufpreis (EUR)
								<input value={priceEuro} onChange={(e) => setPriceEuro(e.target.value)} className={inputCls()} placeholder="z. B. 450000" />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Mietpreis / Monat (EUR){' '}
								<span className="font-normal text-slate-500">(bei Mietobjekten; optional)</span>
								<input
									value={pricePerMonthEuro}
									onChange={(e) => setPricePerMonthEuro(e.target.value)}
									className={inputCls()}
									placeholder="z. B. 1200"
								/>
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Objektart
								<input value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={inputCls()} />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Wohnfläche (m²)
								<input value={livingSpaceSqm} onChange={(e) => setLivingSpaceSqm(e.target.value)} className={inputCls()} />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Zimmer
								<input value={rooms} onChange={(e) => setRooms(e.target.value)} className={inputCls()} />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Land / Region <span className="font-normal text-slate-500">(Freitext, z.&nbsp;B. Montenegro)</span>
								<input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls()} />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								PLZ
								<input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls()} />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Ort
								<input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls()} />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Breitengrad <span className="font-normal text-slate-500">(optional)</span>
								<input value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputCls()} placeholder="42.4411" />
							</label>
							<label className="block text-sm font-medium text-slate-700">
								Längengrad <span className="font-normal text-slate-500">(optional)</span>
								<input value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputCls()} placeholder="19.2636" />
							</label>
						</div>

						<label className="block text-sm font-medium text-slate-700">
							Straße / Hausnr.
							<input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls()} />
						</label>

						<label className="block text-sm font-medium text-slate-700">
							Bild-URLs (eine pro Zeile oder kommagetrennt)
							<textarea
								value={imageUrls}
								onChange={(e) => setImageUrls(e.target.value)}
								rows={3}
								className={`${inputCls()} resize-y`}
								placeholder="https://..."
							/>
						</label>

						<button
							type="submit"
							disabled={busy}
							className="w-fit rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-brand-900 hover:bg-accent-muted disabled:opacity-50"
						>
							{busy ? 'Speichern…' : editingId ? 'Änderungen speichern' : 'Objekt speichern'}
						</button>
					</form>
				</div>
			) : null}

			{tab === 'xml' ? (
				<div className="grid max-w-4xl gap-4">
					<div className="glass-panel-soft space-y-4 p-5">
						<h3 className="text-base font-semibold text-gray-900">Export (Bestand → Datei)</h3>
						<p className="text-xs leading-relaxed text-slate-600">
							Ergänzt den Import: den Firestore‑Bestand gefiltert als{' '}
							<strong className="text-gray-900">Adriom‑kompatibles XML</strong> (wieder über „Analysieren &amp;
							Vorschau“ importierbar) oder als <strong className="text-gray-900">CSV</strong> — entspricht in etwa
							„Export nach CSV/XML“ bei&nbsp;
							<a
								className="font-medium text-amber-900 underline decoration-amber-300/70 underline-offset-2 hover:text-amber-950"
								href="https://www.wpallimport.com/upgrade-to-wp-all-export-pro/"
								target="_blank"
								rel="noopener noreferrer"
							>
								WP All Export Pro
							</a>
							, hier ohne WordPress.
						</p>
						<div className="flex flex-wrap items-end gap-4">
							<label className="block text-sm font-medium text-slate-700">
								Export-Filter
								<select
									value={xmlExportPreset}
									onChange={(e) => setXmlExportPreset(e.target.value as typeof xmlExportPreset)}
									className={`${inputCls()} mt-1 !py-2 w-full min-w-[14rem]`}
								>
									<option value="all">Alle Objekte</option>
									<option value="featured">Nur Featured</option>
									<option value="manual">Quelle: manuell</option>
									<option value="adriom">Quelle: Adriom</option>
									<option value="xml">Quelle: XML (legacy)</option>
								</select>
							</label>
							<label className="block min-w-[12rem] flex-1 text-sm font-medium text-slate-700">
								Zusätzlich: Land enthält&nbsp;
								<span className="font-normal text-slate-500">(optional)</span>
								<input
									value={xmlExportCountry}
									onChange={(e) => setXmlExportCountry(e.target.value)}
									className={`${inputCls()} mt-1`}
									placeholder="z.&nbsp;B. Montenegro"
								/>
							</label>
						</div>
						<p className="text-[11px] text-slate-500">
							Im XML müssen Dokument‑IDs gesetzt sein; ohne <code className="font-mono text-[10px]">id</code> wird
							das Objekt beim Export ausgelassen ({getFilteredListingsForExport().length} von {inventory.length}{' '}
							aktuell).
						</p>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								disabled={busy || inventoryLoading}
								onClick={exportListingsXmlFile}
								className="rounded-xl border border-accent/35 bg-accent/12 px-4 py-2.5 text-sm font-semibold text-brand-950 hover:bg-accent/20 disabled:opacity-50"
							>
								XML herunterladen
							</button>
							<button
								type="button"
								disabled={busy || inventoryLoading}
								onClick={exportListingsCsvFile}
								className="rounded-xl border border-slate-200/90 bg-white/70 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-white disabled:opacity-50"
							>
								CSV herunterladen
							</button>
						</div>
					</div>
					<div className="glass-panel-soft grid gap-6 p-5 sm:grid-cols-2">
						<div className="space-y-3">
							<h3 className="text-sm font-semibold text-gray-900">Import: Zeilen einschränken</h3>
							<p className="text-[11px] leading-relaxed text-slate-600">
								Gilt für Adriom, OpenImmo und CSV — vergleichbar mit Datenfiltern bei{' '}
								<a
									className="font-medium text-amber-900 underline decoration-amber-300/70 underline-offset-2 hover:text-amber-950"
									href="https://www.wpallimport.com/documentation/wp-all-import-in-depth-overview/"
									target="_blank"
									rel="noopener noreferrer"
								>
									WP&nbsp;All&nbsp;Import
								</a>
								, nur ohne WordPress.
							</p>
							<div className="grid gap-3 sm:grid-cols-2">
								<label className="block text-xs font-medium text-slate-700">
									Preis&nbsp;min.&nbsp;(€)
									<input
										type="text"
										inputMode="decimal"
										value={importFilterMinPrice}
										onChange={(e) => setImportFilterMinPrice(e.target.value)}
										className={`${inputCls()} mt-1 text-sm`}
										placeholder="z.&nbsp;B. 100000"
									/>
								</label>
								<label className="block text-xs font-medium text-slate-700">
									Preis&nbsp;max.&nbsp;(€)
									<input
										type="text"
										inputMode="decimal"
										value={importFilterMaxPrice}
										onChange={(e) => setImportFilterMaxPrice(e.target.value)}
										className={`${inputCls()} mt-1 text-sm`}
										placeholder="optional"
									/>
								</label>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<label className="block text-xs font-medium text-slate-700">
									Stadt enthält
									<input
										value={importFilterCity}
										onChange={(e) => setImportFilterCity(e.target.value)}
										className={`${inputCls()} mt-1 text-sm`}
										placeholder="Teilstring"
									/>
								</label>
								<label className="block text-xs font-medium text-slate-700">
									Land enthält
									<input
										value={importFilterCountry}
										onChange={(e) => setImportFilterCountry(e.target.value)}
										className={`${inputCls()} mt-1 text-sm`}
										placeholder="Teilstring"
									/>
								</label>
							</div>
							<label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
								<input
									type="checkbox"
									checked={importFilterFeaturedOnly}
									onChange={(e) => setImportFilterFeaturedOnly(e.target.checked)}
									className="mt-0.5 rounded border-slate-300"
								/>
								<span>Nur Einträge mit „featured“</span>
							</label>
							<label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
								<input
									type="checkbox"
									checked={importFilterRequireImages}
									onChange={(e) => setImportFilterRequireImages(e.target.checked)}
									className="mt-0.5 rounded border-slate-300"
								/>
								<span>Nur Zeilen mit mindestens einem Bild</span>
							</label>
						</div>
						<div className="space-y-4 border-t border-slate-200/80 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
							<h3 className="text-sm font-semibold text-gray-900">Abgleich / Aktualisieren</h3>
							<label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
								<input
									type="checkbox"
									checked={csvDocIdColumn}
									onChange={(e) => setCsvDocIdColumn(e.target.checked)}
									className="mt-0.5 rounded border-slate-300"
								/>
								<span>
									<strong>CSV:</strong> Spalte <code className="rounded bg-slate-100 px-1 font-mono text-[10px]">id</code>{' '}
									ist die Firestore‑Dokument‑ID (wie Adriom‑Re‑Import; bestehende Dokumente werden überschrieben).
								</span>
							</label>
							<label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
								<input
									type="checkbox"
									checked={openImmoMergeByExternalId}
									onChange={(e) => {
										const on = e.target.checked;
										setOpenImmoMergeByExternalId(on);
										if (!on) setImportDeleteMissingByExternalId(false);
									}}
									className="mt-0.5 rounded border-slate-300"
								/>
								<span>
									<strong>OpenImmo &amp; CSV (ohne „id“):</strong> bestehende Einträge anhand{' '}
									<code className="rounded bg-slate-100 px-1 font-mono text-[10px]">externalId</code>{' '}
									aktualisieren (<code className="font-mono text-[10px]">merge</code> in Firestore); sonst immer neue
									Dokumente.
								</span>
							</label>
							<label className="block text-xs font-medium text-slate-700">
								Feed-/Import-Kennzeichen <span className="font-normal text-slate-500">(optional)</span>
								<input
									value={importFeedLabel}
									onChange={(e) => setImportFeedLabel(e.target.value)}
									className={`${inputCls()} mt-1 text-sm`}
									placeholder="z.&nbsp;B. UK-Rightmove — wird als xmlFeedSource gespeichert"
								/>
							</label>
							<label
								className={`flex cursor-pointer items-start gap-2 text-xs text-slate-700 ${!openImmoMergeByExternalId ? 'opacity-50' : ''}`}
							>
								<input
									type="checkbox"
									disabled={!openImmoMergeByExternalId}
									checked={importDeleteMissingByExternalId}
									onChange={(e) => setImportDeleteMissingByExternalId(e.target.checked)}
									className="mt-0.5 rounded border-slate-300"
								/>
								<span>
									<strong>Fehlende Datensätze löschen:</strong> nach dem Import alle Firestore‑Einträge mit{' '}
									<code className="rounded bg-slate-100 px-1 font-mono text-[10px]">source: xml</code> entfernen, deren{' '}
									<code className="font-mono text-[10px]">externalId</code> in dieser Datei nicht mehr vorkommt (wie WP
									„Remove missing“). Erfordert Merge per <code className="font-mono text-[10px]">externalId</code> und{' '}
									<strong className="font-normal">externalId in jeder Zeile</strong>.
								</span>
							</label>
							<label className="block text-xs font-medium text-slate-700">
								Nur Lösch-Kandidaten, deren Feed‑Text/URL enthält…{' '}
								<span className="font-normal text-slate-500">(optional, empfohlen bei mehreren Quellen)</span>
								<input
									value={importDeleteMissingFeedScope}
									onChange={(e) => setImportDeleteMissingFeedScope(e.target.value)}
									disabled={!importDeleteMissingByExternalId}
									className={`${inputCls()} mt-1 text-sm disabled:opacity-50`}
									placeholder="Teilstring aus xmlFeedSource oder xmlFeedSourceUrl"
								/>
								{importDeleteMissingByExternalId ? (
									<p className="mt-1 text-[10px] leading-relaxed text-amber-900/90">
										Ohne Teilstring: alle Dokumente mit{' '}
										<code className="rounded bg-amber-100/80 px-1 font-mono text-[9px]">source: xml</code> und gesetzter{' '}
										<code className="font-mono text-[9px]">externalId</code>, die nicht in dieser Datei sind — nutzen Sie
										Kennzeichen + Teilstring, wenn mehrere Feeds dieselbe Quelle haben.
									</p>
								) : null}
							</label>
							<p className="text-[11px] leading-relaxed text-slate-500">
								Details und Begriffe (Filter, Zuordnung, Update) im{' '}
								<a
									className="font-medium text-amber-900 underline decoration-amber-300/70 underline-offset-2 hover:text-amber-950"
									href="https://www.wpallimport.com/documentation/wp-all-import-in-depth-overview/"
									target="_blank"
									rel="noopener noreferrer"
								>
									Überblicksartikel zu WP&nbsp;All&nbsp;Import
								</a>
								.
							</p>
						</div>
					</div>
					<div className="glass-panel-soft grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
						<label className="block text-sm font-medium text-slate-700">
							Öffentliche Liste (URL)
							<input
								type="url"
								value={xmlFeedUrl}
								onChange={(e) => setXmlFeedUrl(e.target.value)}
								className={inputCls()}
								placeholder="https://…/listings.xml"
							/>
							<span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
								Feeds ohne CORS (z.&nbsp;B. Bitrix-Export) werden nach fehlgeschlagenem Direktabruf automatisch über die
								Cloud Function <code className="rounded bg-slate-100 px-1 font-mono text-[10px]">fetchXmlFeedProxy</code>{' '}
								geladen — einmalig <code className="font-mono text-[10px]">firebase deploy --only functions</code>{' '}
								ausführen (Region <code className="font-mono text-[10px]">europe-west1</code>).
							</span>
						</label>
						<button
							type="button"
							disabled={busy}
							onClick={() => void loadXmlFromUrl()}
							className="h-[46px] shrink-0 rounded-xl border border-accent/40 bg-accent/10 px-4 text-sm font-semibold text-accent hover:bg-accent/20 disabled:opacity-50 sm:mb-0.5"
						>
							{busy ? '…' : 'URL laden'}
						</button>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<label className="text-sm font-medium text-slate-700">
							Titel & Text bevorzugt in{' '}
							<select
								value={langPref}
								onChange={(e) => setLangPref(e.target.value as 'de' | 'en')}
								className={`${inputCls()} mt-1 !py-2 sm:mt-0 sm:ml-2 sm:inline-block sm:w-40`}
							>
								<option value="de">Deutsch</option>
								<option value="en">English</option>
							</select>
						</label>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/90 bg-white/60 px-4 py-2 text-sm font-semibold text-gray-900 backdrop-blur-sm hover:border-amber-200/90 hover:bg-white/85">
							<input
								type="file"
								accept=".xml,.csv,application/xml,text/xml,text/csv"
								className="sr-only"
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (!f) return;
									void f.text().then(setXmlText);
								}}
							/>
							XML- oder CSV-Datei wählen
						</label>
						<span className="text-xs text-slate-500">oder Inhalt unten einfügen</span>
					</div>
					<label className="block text-sm font-medium text-slate-700">
						Exposé-Daten (einfügen oder oben laden)
						<textarea
							value={xmlText}
							onChange={(e) => setXmlText(e.target.value)}
							rows={18}
							className={`${inputCls()} resize-y font-mono text-xs`}
							placeholder="XML-, OpenImmo- oder CSV-Inhalt (Export-CSV) einfügen oder Datei wählen …"
						/>
					</label>
					<p className="text-sm text-slate-600">
						Zuerst analysieren: bei Adriom, OpenImmo oder CSV öffnet sich direkt die Prüfvorschau. Anderes
						gültiges&nbsp;XML startet einen Schritt Feldzuordnung mit Live‑Vorschau (ähnlich WP&nbsp;All&nbsp;Import).
						Sie wählen danach wie gewohnt Zeilen und bestätigen den Import. Bei gleicher Firestore‑Dokument‑ID
						(Adriom oder CSV mit Spalte „id“) ist die Übernahme ein Update. OpenImmo, gemappte Fremd‑Feeds und CSV
						ohne „id“ legen neue Dokumente an — optional per&nbsp;
						<code className="rounded bg-slate-100 px-1 font-mono text-xs">externalId</code> zusammenführen.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							disabled={busy || !xmlText.trim()}
							onClick={analyzeXmlStaging}
							className="w-fit rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-brand-900 hover:bg-accent-muted disabled:opacity-50"
						>
							Analysieren &amp; Vorschau
						</button>
						{busy && xmlDialogOpen ? (
							<span className="self-center text-slate-500 text-sm">Import läuft…</span>
						) : null}
					</div>
				</div>
			) : null}

			{tab === 'blog' ? <AdminMarkdownCollectionEditor variant="blog" /> : null}
			{tab === 'texts' ? <AdminMarkdownCollectionEditor variant="siteTexts" /> : null}

			<XmlImportReviewDialog
				open={xmlDialogOpen}
				staging={xmlStaging}
				loading={xmlStagingLoading}
				prepareProgress={xmlPrepareProgress}
				busy={busy}
				onClose={closeXmlImportDialog}
				onChangeRowChecked={toggleXmlStagingRow}
				onSelectOnlyValid={selectOnlyValidXmlRows}
				onDeselectAll={deselectAllXmlRows}
				onConfirmImport={() => void commitXmlStaging()}
			/>
			<GenericXmlMappingDialog
				open={genericXmlMapOpen}
				xmlText={xmlText}
				onClose={() => setGenericXmlMapOpen(false)}
				onApply={handleGenericXmlMapped}
			/>
			</div>
		</div>
	);
}
