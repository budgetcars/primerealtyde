import { FirebaseError } from 'firebase/app';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
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
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	updateDoc,
	writeBatch,
} from 'firebase/firestore';
import { parseOpenImmoXml } from '../../lib/xml/parseOpenImmo';
import { detectXmlRootTag, parseAdriomXml } from '../../lib/xml/parseAdriom';
import type { Listing, ListingInput, ListingSource } from '../../lib/types';
import { getDb, getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase/client';

const LISTINGS = 'listings';

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

function formatPriceEUR(euro: number | null): string {
	if (euro == null) return 'Auf Anfrage';
	return new Intl.NumberFormat('de-DE', {
		style: 'currency',
		currency: 'EUR',
		maximumFractionDigits: 0,
	}).format(euro);
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

type AdminTab = 'inventory' | 'manual' | 'xml';

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

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editSource, setEditSource] = useState<ListingSource>('manual');

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [priceEuro, setPriceEuro] = useState('');
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

	const loadInventory = useCallback(async () => {
		if (skipped) return;
		const db = getDb();
		setInventoryError(null);
		setInventoryLoading(true);
		try {
			const snap = await getDocs(collection(db, LISTINGS));
			const rows: Listing[] = [];
			snap.forEach((d) => {
				rows.push({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) });
			});
			rows.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'de', { sensitivity: 'base' }));
			setInventory(rows);
		} catch (e: unknown) {
			setInventoryError(e instanceof Error ? e.message : 'Bestand konnte nicht geladen werden');
		} finally {
			setInventoryLoading(false);
		}
	}, [skipped]);

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
		void loadInventory();
	}, [skipped, user, loadInventory]);

	function clearManualForm() {
		setEditingId(null);
		setEditSource('manual');
		setTitle('');
		setDescription('');
		setPriceEuro('');
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
			const payload = buildPayload();
			const db = getDb();

			if (editingId) {
				const ref = doc(db, LISTINGS, editingId);
				await updateDoc(ref, omitUndefinedShallow(payload as unknown as Record<string, unknown>));
				setStatus('Objekt wurde aktualisiert.');
			} else {
				await addDoc(collection(db, LISTINGS), {
					...payload,
					createdAt: serverTimestamp(),
				});
				setStatus('Objekt wurde gespeichert.');
			}

			clearManualForm();
			await loadInventory();
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
			await loadInventory();
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
			await loadInventory();
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Änderung fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function loadXmlFromUrl() {
		setStatus(null);
		setBusy(true);
		try {
			const res = await fetch(xmlFeedUrl.trim(), { mode: 'cors' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const text = await res.text();
			setXmlText(text);
			setStatus(`Daten geladen (${text.length.toLocaleString('de-DE')} Zeichen). „Objekte übernehmen“ zum Speichern.`);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Laden fehlgeschlagen';
			setStatus(
				`${msg} – bei Bedarf Inhalt manuell einfügen oder eine Export-Datei von Ihrem Rechner wählen.`,
			);
		} finally {
			setBusy(false);
		}
	}

	async function submitXml(ev: FormEvent) {
		ev.preventDefault();
		setStatus(null);
		setBusy(true);
		try {
			const raw = xmlText.trim();
			if (!raw) {
				setStatus('Bitte Inhalt einfügen oder per URL laden.');
				return;
			}
			const kind = detectXmlRootTag(raw);
			const db = getDb();

			if (kind === 'listings') {
				const langs = langPref === 'de' ? ['de', 'en', 'sr', 'ru'] : ['en', 'de', 'sr', 'ru'];
				const { feedMeta, items } = parseAdriomXml(raw, langs);
				if (!items.length) {
					setStatus('Keine Einträge in der geladenen Liste erkannt.');
					return;
				}
				const chunkSize = 400;
				let upserted = 0;
				for (let i = 0; i < items.length; i += chunkSize) {
					const slice = items.slice(i, i + chunkSize);
					const refs = slice.map((it) => doc(db, LISTINGS, it.firestoreDocumentId));
					const snaps = await Promise.all(refs.map((r) => getDoc(r)));
					const batch = writeBatch(db);
					for (let j = 0; j < slice.length; j++) {
						const row = slice[j]!;
						const exists = snaps[j]!.exists();
						const { firestoreDocumentId: _listingDocId, ...rest } = row;
						batch.set(
							refs[j]!,
							{
								...rest,
								syncedAt: serverTimestamp(),
								...(exists ? {} : { createdAt: serverTimestamp() }),
							},
							{ merge: true },
						);
						upserted++;
					}
					await batch.commit();
				}
				const meta = feedMeta.generated ? ` (Stand der Quelle: ${feedMeta.generated})` : '';
				setStatus(`${upserted} Objekt(e) übernommen${meta}. Bestehende Einträge werden bei erneutem Übernehmen aktualisiert.`);
				await loadInventory();
				return;
			}

			if (kind === 'openimmo') {
				const parsed = parseOpenImmoXml(raw);
				if (!parsed.length) {
					setStatus('Keine Immobilien in den Daten gefunden.');
					return;
				}
				const chunkSize = 450;
				for (let i = 0; i < parsed.length; i += chunkSize) {
					const chunk = parsed.slice(i, i + chunkSize);
					const batch = writeBatch(db);
					for (const item of chunk) {
						const ref = doc(collection(db, LISTINGS));
						batch.set(ref, { ...item, createdAt: serverTimestamp() });
					}
					await batch.commit();
				}
				setStatus(`${parsed.length} Objekt(e) übernommen (neue Einträge).`);
				setXmlText('');
				await loadInventory();
				return;
			}

			setStatus('Unbekanntes Format – der Inhalt konnte nicht verarbeitet werden.');
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
					Sicherheitsregeln für die Collection{' '}
					<code className="font-mono text-xs">listings</code> setzen.
				</p>
			</div>
		);
	}

	if (!authReady)
		return <div className="h-40 animate-pulse rounded-xl border border-white/60 bg-white/40 backdrop-blur-sm" aria-hidden="true" />;

	if (!user) {
		return (
			<form onSubmit={login} className="glass-panel-soft mx-auto max-w-md px-8 py-10">
				<h2 className="text-xl font-semibold text-gray-900">Verwaltung anmelden</h2>
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
		`rounded-lg px-4 py-2 text-sm font-semibold transition ${
			tab === t ? 'bg-accent text-brand-900 shadow-sm' : 'text-slate-600 hover:bg-white/50 hover:text-gray-900'
		}`;

	return (
		<div className="space-y-8">
			<div className="glass-panel-soft flex flex-wrap items-center justify-between gap-4 px-6 py-4">
				<div>
					<p className="text-sm font-medium text-slate-600">Administration</p>
					<p className="mt-0.5 text-sm text-slate-700">
						Angemeldet als <span className="font-semibold text-gray-900">{user.email}</span>
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						disabled={inventoryLoading || busy}
						onClick={() => void loadInventory()}
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

			<div className="flex flex-wrap gap-2 border-b border-white/70 pb-2">
				<button type="button" onClick={() => setTab('inventory')} className={tabCls('inventory')}>
					Bestand{' '}
					<span className="font-normal opacity-75">({inventory.length})</span>
				</button>
				<button type="button" onClick={() => setTab('manual')} className={tabCls('manual')}>
					{editingId ? 'Objekt bearbeiten' : 'Manuell'}
				</button>
				<button type="button" onClick={() => setTab('xml')} className={tabCls('xml')}>
					Feed / XML
				</button>
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
					{inventoryLoading && !inventory.length ? (
						<div className="h-56 animate-pulse rounded-xl border border-white/55 bg-white/35 backdrop-blur-sm" />
					) : inventory.length === 0 ? (
						<p className="glass-panel-soft px-5 py-8 text-center text-sm text-slate-600">Noch keine Objekte – legen Sie welche unter „Manuell“ oder „Feed / XML“ an.</p>
					) : (
						<div className="-mx-1 overflow-x-auto rounded-xl border border-white/60 bg-white/[0.42] backdrop-blur-md">
							<table className="w-full min-w-[42rem] text-left text-sm">
								<thead>
									<tr className="border-b border-white/60 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
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
											<tr key={id || label} className="border-b border-white/50 last:border-0">
												<td className="px-4 py-3">
													<div className="font-medium text-gray-900">{row.title}</div>
													<div className="mt-0.5 text-xs text-slate-500 sm:hidden">{[row.country, row.city].filter(Boolean).join(' · ')}</div>
													<div className="mt-1 flex flex-wrap gap-2">
														{row.featured ? (
															<span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
																Featured
															</span>
														) : null}
													</div>
												</td>
												<td className="hidden px-2 py-3 text-slate-700 sm:table-cell">
													{[row.country, row.city, row.zip].filter(Boolean).join(' · ') || '—'}
												</td>
												<td className="whitespace-nowrap px-2 py-3 font-medium text-slate-800">{formatPriceEUR(row.priceEuro)}</td>
												<td className="max-w-[7rem] truncate px-2 py-3 capitalize text-slate-600">{row.source ?? '—'}</td>
												<td className="space-y-1 px-4 py-3 text-right">
													<div className="flex flex-wrap justify-end gap-2">
														<button
															type="button"
															disabled={busy}
															onClick={() => void toggleFeatured(id, row.featured)}
															className="rounded-lg border border-slate-200/90 bg-white/60 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-white"
														>
															{row.featured ? 'Featured aus' : 'Featured'}
														</button>
														<a
															href={previewHref}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex rounded-lg border border-slate-200/90 bg-white/60 px-2.5 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-50/90"
														>
															Ansehen
														</a>
														<button
															type="button"
															disabled={busy || !id}
															onClick={() => populateFromListing(row)}
															className="rounded-lg border border-accent/35 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-brand-950 hover:bg-accent/25"
														>
															Bearbeiten
														</button>
														<button
															type="button"
															disabled={busy || !id}
															onClick={() => void removeListing(id, label)}
															className="rounded-lg border border-red-200/85 bg-red-50/85 px-2.5 py-1 text-xs font-semibold text-red-900 hover:bg-red-100/90"
														>
															Löschen
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
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
				<form onSubmit={submitXml} className="grid max-w-4xl gap-4">
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
								accept=".xml,application/xml,text/xml"
								className="sr-only"
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (!f) return;
									void f.text().then(setXmlText);
								}}
							/>
							Export-Datei wählen
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
							placeholder="Inhalt von „URL laden“ hier einfügen oder Datei wählen …"
						/>
					</label>
					<p className="text-sm text-slate-600">
						Wiederholtes Übernehmen aktualisiert vorhandene Objekte, wenn die Quelle dieselben Kennungen liefert –
						ansonsten entstehen neue Einträge.
					</p>
					<button
						type="submit"
						disabled={busy || !xmlText.trim()}
						className="w-fit rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-brand-900 hover:bg-accent-muted disabled:opacity-50"
					>
						{busy ? 'Übernehmen…' : 'Objekte übernehmen'}
					</button>
				</form>
			) : null}
		</div>
	);
}
