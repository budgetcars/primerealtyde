import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import type { BlogPostDoc, SiteTextDoc } from '../../lib/types';
import type { Locale } from '../../i18n/locale';
import { contentDocumentId, normalizeContentSlug } from '../../lib/contentDocumentId';
import { getDb, isFirebaseConfigured } from '../../lib/firebase/client';

type CollectionName = 'blogPosts' | 'siteTexts';

const mdWrap =
	'max-w-3xl [&_a]:font-medium [&_a]:text-amber-900 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-amber-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-sm [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-gray-900 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6';

export type FirestoreArticleClientProps = {
	locale: Locale;
	collection: CollectionName;
	slug: string | null;
	notFoundMessage: string;
	backHref: string;
	backLabel: string;
};

export function FirestoreArticleClient({
	locale,
	collection: collName,
	slug: slugParam,
	notFoundMessage,
	backHref,
	backLabel,
}: FirestoreArticleClientProps) {
	const skipped = !isFirebaseConfigured();
	const [row, setRow] = useState<BlogPostDoc | SiteTextDoc | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (skipped) {
			setRow(null);
			setLoading(false);
			return;
		}
		const slug = normalizeContentSlug(slugParam ?? '');
		if (!slug) {
			setRow(null);
			setLoading(false);
			return;
		}
		let cancelled = false;
		(async () => {
			setLoading(true);
			setRow(null);
			try {
				const db = getDb();
				const id = contentDocumentId(locale, slug);
				const snap = await getDoc(doc(db, collName, id));
				if (cancelled) return;
				if (!snap.exists()) {
					setRow(null);
					return;
				}
				const data = snap.data() as Omit<BlogPostDoc, 'id'>;
				if (!data.published) {
					setRow(null);
					return;
				}
				setRow({ id: snap.id, ...data });
			} catch {
				if (!cancelled) setRow(null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [skipped, collName, locale, slugParam]);

	if (skipped) {
		return (
			<p className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
				Artikel kann nicht geladen werden (Firebase nicht konfiguriert).
			</p>
		);
	}

	if (loading) {
		return <div className="h-56 animate-pulse rounded-xl border border-white/55 bg-white/40 backdrop-blur-sm" aria-hidden="true" />;
	}

	if (!loading && (row === null || !slugParam?.trim())) {
		return (
			<div className="glass-panel-soft space-y-4 rounded-2xl p-6">
				<p className="text-slate-700">{notFoundMessage}</p>
				<a href={backHref} className="inline-flex text-sm font-semibold text-amber-950 underline decoration-amber-300 hover:decoration-amber-500">
					{backLabel}
				</a>
			</div>
		);
	}

	if (!row) return null;

	const excerpt = collName === 'blogPosts' && 'excerpt' in row ? (row as BlogPostDoc).excerpt : '';

	return (
		<article className="glass-panel-soft rounded-2xl px-6 py-8 md:px-10 md:py-10">
			<h1 className="font-heading-display text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">{row.title}</h1>
			{excerpt ? (
				<div className={`mt-4 text-lg text-slate-600 ${mdWrap}`}>
					<ReactMarkdown>{excerpt}</ReactMarkdown>
				</div>
			) : null}
			<div className={`mt-8 text-slate-800 ${mdWrap}`}>
				<ReactMarkdown>{row.bodyMarkdown || ''}</ReactMarkdown>
			</div>
			<p className="mt-10 border-t border-white/60 pt-6">
				<a href={backHref} className="text-sm font-semibold text-amber-950 underline decoration-amber-300 hover:decoration-amber-500">
					{backLabel}
				</a>
			</p>
		</article>
	);
}
