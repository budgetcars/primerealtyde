import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import type { BlogPostDoc, SiteTextDoc } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { locales } from '../../i18n/locale';
import { contentDocumentId, normalizeContentSlug } from '../../lib/contentDocumentId';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';

type Variant = 'blog' | 'siteTexts';

const COLLECTION: Record<Variant, string> = {
	blog: 'blogPosts',
	siteTexts: 'siteTexts',
};

function inputCls() {
	return 'mt-1 w-full rounded-xl border border-slate-200/90 bg-white/70 px-4 py-3 text-gray-900 shadow-sm outline-none backdrop-blur-sm transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50';
}

function navBtn(active: boolean) {
	return `w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
		active ? 'bg-accent text-brand-900 shadow-sm' : 'text-slate-700 hover:bg-white/60 hover:text-gray-900'
	}`;
}

export function AdminMarkdownCollectionEditor({ variant }: { variant: Variant }) {
	const skipped = !isFirebaseConfigured();
	const collName = COLLECTION[variant];
	const isBlog = variant === 'blog';

	const [rows, setRows] = useState<(BlogPostDoc | SiteTextDoc)[]>([]);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [localStatus, setLocalStatus] = useState<string | null>(null);

	const [editSlug, setEditSlug] = useState('');
	const [locale, setLocale] = useState<Locale>('de');
	const [title, setTitle] = useState('');
	const [excerpt, setExcerpt] = useState('');
	const [bodyMarkdown, setBodyMarkdown] = useState('');
	const [published, setPublished] = useState(false);
	const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
	const [editingExisting, setEditingExisting] = useState(false);

	const load = useCallback(async () => {
		if (skipped) return;
		setErr(null);
		setLoading(true);
		try {
			const db = getDb();
			const snap = await getDocs(collection(db, collName));
			const list: (BlogPostDoc | SiteTextDoc)[] = [];
			snap.forEach((d) => {
				list.push({ id: d.id, ...(d.data() as Omit<BlogPostDoc, 'id'>) });
			});
			list.sort((a, b) => {
				const ua = a.updatedAt?.seconds ?? 0;
				const ub = b.updatedAt?.seconds ?? 0;
				return ub - ua;
			});
			setRows(list);
		} catch (e: unknown) {
			setErr(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
		} finally {
			setLoading(false);
		}
	}, [skipped, collName]);

	useEffect(() => {
		void load();
	}, [load]);

	function startNew() {
		setSelectedDocId(null);
		setEditingExisting(false);
		setEditSlug('');
		setLocale('de');
		setTitle('');
		setExcerpt('');
		setBodyMarkdown('');
		setPublished(false);
		setLocalStatus(null);
	}

	function startEdit(row: BlogPostDoc | SiteTextDoc) {
		const id = row.id ?? '';
		setSelectedDocId(id || null);
		setEditingExisting(true);
		const und = id.indexOf('_');
		const locCandidate = und > 0 ? id.slice(0, und) : '';
		const loc =
			locCandidate && locales.includes(locCandidate as Locale) ? (locCandidate as Locale) : row.locale;
		const slugPart = und > 0 ? id.slice(und + 1) || row.slug : row.slug;
		setEditSlug(slugPart || row.slug);
		setLocale(row.locale ?? loc);
		setTitle(row.title ?? '');
		setExcerpt(isBlog && 'excerpt' in row ? (row as BlogPostDoc).excerpt ?? '' : '');
		setBodyMarkdown(row.bodyMarkdown ?? '');
		setPublished(Boolean(row.published));
		setLocalStatus(null);
	}

	async function save() {
		if (skipped) return;
		const slug = normalizeContentSlug(editSlug);
		if (!slug) {
			setLocalStatus('Bitte einen URL-Slug setzen (nur Kleinbuchstaben, Zahlen, Bindestrich).');
			return;
		}
		if (!title.trim()) {
			setLocalStatus('Bitte einen Titel eingeben.');
			return;
		}
		const id = contentDocumentId(locale, slug);
		setBusy(true);
		setLocalStatus(null);
		setErr(null);
		try {
			const db = getDb();
			const base = {
				locale,
				slug,
				title: title.trim(),
				bodyMarkdown,
				published,
				updatedAt: serverTimestamp(),
			};
			if (isBlog) {
				await setDoc(doc(db, collName, id), { ...base, excerpt: excerpt.trim() });
			} else {
				await setDoc(doc(db, collName, id), base);
			}
			setLocalStatus('Gespeichert.');
			await load();
		} catch (e: unknown) {
			setErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	async function removeCurrent() {
		if (skipped) return;
		const slug = normalizeContentSlug(editSlug);
		if (!slug) return;
		const id = contentDocumentId(locale, slug);
		if (!window.confirm(`Eintrag „${id}“ wirklich löschen?`)) return;
		setBusy(true);
		setErr(null);
		try {
			const db = getDb();
			await deleteDoc(doc(db, collName, id));
			setLocalStatus('Gelöscht.');
			startNew();
			await load();
		} catch (e: unknown) {
			setErr(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
		} finally {
			setBusy(false);
		}
	}

	const heading = isBlog ? 'Blogbeiträge' : 'Textseiten';
	const intro = isBlog
		? 'Beiträge erscheinen unter /blog (nur veröffentlichte). Slug = URL-Teil (z. B. willkommen-in-montenegro).'
		: 'Zusätzliche Textseiten unter /text (nur veröffentlichte). Für Impressum/Datenschutz nutzen Sie weiter die festen Seiten oder ergänzen hier Editorial.';

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-gray-900">{heading}</h2>
				<p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{intro}</p>
			</div>

			{err ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
			) : null}
			{localStatus ? (
				<p className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-2 text-sm text-emerald-900">{localStatus}</p>
			) : null}

			<div className="grid gap-8 lg:grid-cols-[minmax(0,14rem)_1fr]">
				<div className="space-y-2">
					<p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Einträge</p>
					<button type="button" onClick={startNew} className={navBtn(!editingExisting)}>
						+ Neu
					</button>
					<div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-xl border border-white/60 bg-white/40 p-2 backdrop-blur-sm">
						{loading && !rows.length ? (
							<div className="h-24 animate-pulse rounded-lg bg-white/50" />
						) : rows.length === 0 ? (
							<p className="px-2 py-4 text-center text-xs text-slate-500">Noch keine Einträge</p>
						) : (
							rows.map((row) => {
								const id = row.id ?? '';
								const active = editingExisting && id === selectedDocId;
								return (
									<button
										key={id}
										type="button"
										onClick={() => startEdit(row)}
										className={navBtn(active)}
									>
										<span className="block truncate text-xs font-normal uppercase text-slate-500">{row.locale}</span>
										<span className="block truncate">{row.title || id}</span>
									</button>
								);
							})
						)}
					</div>
					<button
						type="button"
						disabled={loading}
						onClick={() => void load()}
						className="w-full rounded-lg border border-slate-200/90 bg-white/50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-white disabled:opacity-50"
					>
						{loading ? '…' : 'Liste aktualisieren'}
					</button>
				</div>

				<div className="glass-panel-soft space-y-5 rounded-2xl p-5 md:p-6">
					<h3 className="text-base font-semibold text-gray-900">{editSlug ? 'Eintrag bearbeiten' : 'Neuen Eintrag anlegen'}</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block text-sm font-medium text-slate-700">
							Sprache
							<select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className={`${inputCls()} !py-2`}>
								{locales.map((l) => (
									<option key={l} value={l}>
										{l}
									</option>
								))}
							</select>
						</label>
						<label className="block text-sm font-medium text-slate-700">
							URL-Slug <span className="font-normal text-slate-500">(nur a–z, 0–9, -)</span>
							<input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className={inputCls()} placeholder="z-b-mein-beitrag" />
						</label>
					</div>
					<label className="block text-sm font-medium text-slate-700">
						Titel
						<input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls()} required />
					</label>
					{isBlog ? (
						<label className="block text-sm font-medium text-slate-700">
							Kurztext / Teaser <span className="font-normal text-slate-500">(optional, Markdown)</span>
							<textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className={`${inputCls()} resize-y`} />
						</label>
					) : null}
					<label className="block text-sm font-medium text-slate-700">
						Inhalt (Markdown)
						<textarea
							value={bodyMarkdown}
							onChange={(e) => setBodyMarkdown(e.target.value)}
							rows={16}
							className={`${inputCls()} resize-y font-mono text-sm leading-relaxed`}
						/>
					</label>
					<label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
						<input
							type="checkbox"
							className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-amber-200"
							checked={published}
							onChange={(e) => setPublished(e.target.checked)}
						/>
						Veröffentlicht (öffentlich sichtbar)
					</label>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							disabled={busy}
							onClick={() => void save()}
							className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-brand-900 hover:bg-accent-muted disabled:opacity-50"
						>
							{busy ? 'Speichern…' : 'Speichern'}
						</button>
						<button
							type="button"
							disabled={busy || !normalizeContentSlug(editSlug)}
							onClick={() => void removeCurrent()}
							className="rounded-xl border border-red-200/90 bg-red-50/90 px-6 py-3 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
						>
							Löschen
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
