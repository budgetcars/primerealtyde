import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { BlogPostDoc, SiteTextDoc } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';

type CollectionName = 'blogPosts' | 'siteTexts';

export type FirestoreArticleListClientProps = {
	locale: Locale;
	collection: CollectionName;
	/** z. B. `/blog/beitrag` oder `/text/beitrag` — mit Sprachpräfix */
	articleHrefBase: string;
	emptyMessage: string;
	readMoreLabel: string;
};

export function FirestoreArticleListClient({
	locale,
	collection: collName,
	articleHrefBase,
	emptyMessage,
	readMoreLabel,
}: FirestoreArticleListClientProps) {
	const skipped = !isFirebaseConfigured();
	const [rows, setRows] = useState<(BlogPostDoc | SiteTextDoc)[]>([]);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		if (skipped) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		(async () => {
			setErr(null);
			setLoading(true);
			try {
				const db = getDb();
				const q = query(collection(db, collName), where('locale', '==', locale), where('published', '==', true));
				const snap = await getDocs(q);
				const list: (BlogPostDoc | SiteTextDoc)[] = [];
				snap.forEach((d) => {
					list.push({ id: d.id, ...(d.data() as Omit<BlogPostDoc, 'id'>) });
				});
				list.sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
				if (!cancelled) setRows(list);
			} catch (e: unknown) {
				if (!cancelled) setErr(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [skipped, collName, locale]);

	if (skipped) {
		return (
			<p className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
				Inhalt kann nicht geladen werden (Firebase nicht konfiguriert).
			</p>
		);
	}

	if (loading) {
		return <div className="h-40 animate-pulse rounded-xl border border-white/55 bg-white/40 backdrop-blur-sm" aria-hidden="true" />;
	}

	if (err) {
		return <p className="text-sm text-red-800">{err}</p>;
	}

	if (rows.length === 0) {
		return <p className="text-slate-600">{emptyMessage}</p>;
	}

	return (
		<ul className="space-y-4">
			{rows.map((row) => {
				const slug = row.slug || '';
				const href = `${articleHrefBase}?slug=${encodeURIComponent(slug)}`;
				const teaser =
					collName === 'blogPosts' && 'excerpt' in row && (row as BlogPostDoc).excerpt
						? (row as BlogPostDoc).excerpt
						: null;
				return (
					<li key={row.id ?? slug} className="glass-panel-soft rounded-2xl p-5 md:p-6">
						<h2 className="font-heading-display text-xl font-semibold text-gray-900">
							<a href={href} className="text-amber-950 underline decoration-amber-300/60 underline-offset-4 hover:decoration-amber-500">
								{row.title}
							</a>
						</h2>
						{teaser ? (
							<p className="mt-2 text-sm leading-relaxed text-slate-600">{teaser}</p>
						) : null}
						<p className="mt-3">
							<a
								href={href}
								className="inline-flex rounded-xl border border-amber-200/80 bg-amber-100/80 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-50"
							>
								{readMoreLabel}
							</a>
						</p>
					</li>
				);
			})}
		</ul>
	);
}
