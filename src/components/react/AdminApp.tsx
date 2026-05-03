import { type FormEvent, useEffect, useState } from 'react';
import {
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	type User,
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { parseOpenImmoXml } from '../../lib/xml/parseOpenImmo';
import { detectXmlRootTag, parseAdriomXml } from '../../lib/xml/parseAdriom';
import type { ListingInput } from '../../lib/types';
import { getDb, getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase/client';

const LISTINGS = 'listings';

function inputCls() {
	return 'mt-1 w-full rounded-xl border border-slate-200/90 bg-white/70 px-4 py-3 text-gray-900 shadow-sm outline-none backdrop-blur-sm transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50';
}

export function AdminApp() {
	const skipped = !isFirebaseConfigured();
	const [user, setUser] = useState<User | null>(null);
	const [authReady, setAuthReady] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [authError, setAuthError] = useState<string | null>(null);
	const [tab, setTab] = useState<'manual' | 'xml'>('manual');
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [priceEuro, setPriceEuro] = useState('');
	const [livingSpaceSqm, setLivingSpaceSqm] = useState('');
	const [rooms, setRooms] = useState('');
	const [propertyType, setPropertyType] = useState('Ferienwohnung');
	const [city, setCity] = useState('');
	const [zip, setZip] = useState('');
	const [street, setStreet] = useState('');
	const [imageUrls, setImageUrls] = useState('');

	const [xmlText, setXmlText] = useState('');
	const [xmlFeedUrl, setXmlFeedUrl] = useState('https://adriom.me/api/listings.xml');
	const [langPref, setLangPref] = useState<'de' | 'en'>('de');

	useEffect(() => {
		if (skipped) return;
		const auth = getFirebaseAuth();
		return onAuthStateChanged(auth, (u) => {
			setUser(u);
			setAuthReady(true);
		});
	}, [skipped]);

	if (skipped) return null;
	if (!authReady)
		return <div className="h-40 animate-pulse rounded-xl border border-white/60 bg-white/40 backdrop-blur-sm" aria-hidden="true" />;

	async function login(ev: FormEvent) {
		ev.preventDefault();
		setAuthError(null);
		setBusy(true);
		try {
			await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
		} catch (e: unknown) {
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
			const images = imageUrls
				.split(/[\n,]+/)
				.map((s) => s.trim())
				.filter(Boolean);
			const payload: ListingInput = {
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
				source: 'manual',
			};
			await addDoc(collection(getDb(), LISTINGS), {
				...payload,
				createdAt: serverTimestamp(),
			});
			setStatus('Objekt wurde gespeichert.');
			setTitle('');
			setDescription('');
			setPriceEuro('');
			setLivingSpaceSqm('');
			setRooms('');
			setCity('');
			setZip('');
			setStreet('');
			setImageUrls('');
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
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
				return;
			}

			setStatus('Unbekanntes Format – der Inhalt konnte nicht verarbeitet werden.');
		} catch (e: unknown) {
			setStatus(e instanceof Error ? e.message : 'Übernehmen fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	if (!user) {
		return (
			<form onSubmit={login} className="glass-panel-soft mx-auto max-w-md px-8 py-10">
				<h2 className="text-xl font-semibold text-gray-900">Verwaltung anmelden</h2>
				<p className="mt-2 text-sm text-slate-600">
					Nur für autorisierte Nutzer. Benutzer anlegen Sie in der Firebase Console unter Authentication.
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
				{authError ? <p className="mt-4 text-sm text-red-700">{authError}</p> : null}
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

	return (
		<div className="space-y-8">
			<div className="glass-panel-soft flex flex-wrap items-center justify-between gap-4 px-6 py-4">
				<p className="text-sm text-slate-700">
					Angemeldet als <span className="font-semibold text-gray-900">{user.email}</span>
				</p>
				<button
					type="button"
					onClick={() => void logout()}
					className="rounded-lg border border-slate-200/90 bg-white/50 px-4 py-2 text-sm font-semibold text-gray-900 backdrop-blur-sm hover:bg-white/80"
				>
					Abmelden
				</button>
			</div>

			<div className="flex gap-2 border-b border-white/70 pb-2">
				<button
					type="button"
					onClick={() => setTab('manual')}
					className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
						tab === 'manual'
							? 'bg-accent text-brand-900 shadow-sm'
							: 'text-slate-600 hover:bg-white/50 hover:text-gray-900'
					}`}
				>
					Manuell hinzufügen
				</button>
				<button
					type="button"
					onClick={() => setTab('xml')}
					className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
						tab === 'xml'
							? 'bg-accent text-brand-900 shadow-sm'
							: 'text-slate-600 hover:bg-white/50 hover:text-gray-900'
					}`}
				>
					Aus Datei / URL
				</button>
			</div>

			{status ? (
				<p className="glass-panel-soft px-4 py-3 text-sm font-medium text-slate-800">{status}</p>
			) : null}

			{tab === 'manual' ? (
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
							PLZ
							<input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls()} />
						</label>
						<label className="block text-sm font-medium text-slate-700">
							Ort
							<input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls()} />
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
						{busy ? 'Speichern…' : 'Objekt speichern'}
					</button>
				</form>
			) : (
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
			)}
		</div>
	);
}
