import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ListingInput } from '../../lib/types';
import {
	collectRelativePathsFromRecord,
	collectXmlTagCounts,
	type GenericXmlFieldMapping,
	type XmlPathSample,
	defaultGenericXmlFieldMapping,
	listRecordElements,
	listingInputFromMappedRecord,
	parseGenericXmlDocument,
	guessMappingFromPaths,
} from '../../lib/import/genericXmlMap';
import { buildXmlPathTree, type XmlPathTreeNode } from '../../lib/import/xmlPathTree';

const TREE_PATH_CAP = 600;

type GenericXmlMappingDialogProps = {
	open: boolean;
	xmlText: string;
	onClose: () => void;
	/** Übernimmt gebaute Datensätze in die bestehende Import-Prüfung (wie OpenImmo/CSV ohne id). */
	onApply: (listings: ListingInput[]) => void;
};

const MAP_KEYS: {
	key: keyof GenericXmlFieldMapping;
	label: string;
	helper?: string;
	multiline?: boolean;
	rows?: number;
}[] = [
	{ key: 'title', label: 'Titel', helper: 'z. B. {{advert_heading}}' },
	{
		key: 'description',
		label: 'Beschreibung',
		multiline: true,
		rows: 4,
		helper: '{{main_advert}} — mehrere Elemente kombinieren: „TEXT {{town}}"',
	},
	{ key: 'priceEuro', label: 'Preis (Zahl oder Text wie £94 950)', helper: '{{numeric_price}}' },
	{ key: 'propertyType', label: 'Immobilientyp', helper: 'Standard: Ferienwohnung wenn leer nach Auflösung' },
	{ key: 'street', label: 'Straße' },
	{ key: 'zip', label: 'PLZ', helper: '{{postcode}}' },
	{ key: 'city', label: 'Ort' },
	{ key: 'country', label: 'Land' },
	{ key: 'rooms', label: 'Zimmer (Ganzzahl)' },
	{ key: 'bedrooms', label: 'Schlafzimmer', helper: 'optional; falls abweichend' },
	{ key: 'bathrooms', label: 'Badezimmer' },
	{ key: 'livingSpaceSqm', label: 'Wohnfläche (m²)' },
	{
		key: 'images',
		label: 'Bild-URLs',
		multiline: true,
		rows: 4,
		helper: 'Eine Zeile pro Bild: {{picture[0]/url}} — Platzhalter & Text aus der rechten Liste ziehen',
	},
	{ key: 'listingUrl', label: 'Expose-Link', helper: 'optional' },
	{ key: 'externalId', label: 'Eindeutige Fremd-ID', helper: 'z. B. {{@reference}} für späteren Merge' },
	{ key: 'featured', label: 'Featured (Ja/Nein)', helper: 'z. B. {{propertyofweek}}' },
	{ key: 'latitude', label: 'Breitengrad' },
	{ key: 'longitude', label: 'Längengrad' },
];

function fieldInputCls(multiline?: boolean): string {
	return multiline
		? 'mt-1 w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 font-mono text-xs text-gray-900 shadow-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50'
		: 'mt-1 w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 font-mono text-xs text-gray-900 shadow-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50';
}

function tokenForDrag(path: string): string {
	if (path.startsWith('{{') && path.endsWith('}}')) return path;
	return `{{${path}}}`;
}

function PathLeafButton({
	sample,
	onPathClick,
}: {
	sample: XmlPathSample;
	onPathClick: (path: string) => void;
}) {
	return (
		<button
			type="button"
			draggable
			title="Ziehen in ein Feld oder klicken"
			onDragStart={(e) => {
				const t = tokenForDrag(sample.path);
				e.dataTransfer.setData('text/plain', t);
				e.dataTransfer.setData('Text', t);
				e.dataTransfer.effectAllowed = 'copy';
			}}
			onClick={() => onPathClick(sample.path)}
			className="w-full rounded-md border border-transparent px-2 py-1.5 text-left font-mono text-[11px] text-slate-800 hover:border-amber-200/80 hover:bg-white"
		>
			<span className="text-accent-950">{sample.path}</span>
			{sample.sample ? (
				<span className="block truncate text-slate-500 text-[10px]" title={sample.sample}>
					{sample.sample}
				</span>
			) : null}
		</button>
	);
}

function NestedPathTree({
	nodes,
	depth,
	onPathClick,
}: {
	nodes: XmlPathTreeNode[];
	depth: number;
	onPathClick: (path: string) => void;
}) {
	if (!nodes.length) return null;
	return (
		<ul className={depth > 0 ? 'space-y-0.5 pt-0.5' : 'space-y-0.5'}>
			{nodes.map((node, i) => (
				<li key={`${depth}-${node.segment}-${i}`} className="text-left">
					{node.children.length > 0 ? (
						<details className="group rounded-md py-0.5" open={depth < 3}>
							<summary className="cursor-pointer select-none rounded-md px-1 py-1 font-mono text-slate-600 text-xs hover:bg-white/95 [&::-webkit-details-marker]:hidden">
								<span className="mr-1 text-[10px] text-slate-400 group-open:hidden">▸</span>
								<span className="mr-1 text-[10px] text-slate-400 hidden group-open:inline">▾</span>
								{node.segment}
							</summary>
							<div className="ml-2 border-l border-dashed border-slate-300/70 pl-2">
								{node.leaf ? <PathLeafButton sample={node.leaf} onPathClick={onPathClick} /> : null}
								<NestedPathTree nodes={node.children} depth={depth + 1} onPathClick={onPathClick} />
							</div>
						</details>
					) : node.leaf ? (
						<PathLeafButton sample={node.leaf} onPathClick={onPathClick} />
					) : (
						<div className="px-2 py-1 font-mono text-[10px] text-slate-400">{node.segment}</div>
					)}
				</li>
			))}
		</ul>
	);
}

export function GenericXmlMappingDialog(props: GenericXmlMappingDialogProps) {
	const { open, xmlText, onClose, onApply } = props;

	const [parseError, setParseError] = useState<string | null>(null);
	const [tagCounts, setTagCounts] = useState<{ name: string; count: number }[]>([]);
	const [selectedTag, setSelectedTag] = useState('');
	const [recordIndex, setRecordIndex] = useState(0);
	const [mapping, setMapping] = useState<GenericXmlFieldMapping>(() => defaultGenericXmlFieldMapping());
	const [pathFilter, setPathFilter] = useState('');
	const [lastFocusedKey, setLastFocusedKey] = useState<keyof GenericXmlFieldMapping | null>('title');
	const [dragOverKey, setDragOverKey] = useState<keyof GenericXmlFieldMapping | null>(null);

	useEffect(() => {
		if (!open) {
			setDragOverKey(null);
			return;
		}
		const clear = () => setDragOverKey(null);
		window.addEventListener('dragend', clear);
		return () => {
			window.removeEventListener('dragend', clear);
		};
	}, [open]);

	const parsed = useMemo(() => {
		if (!open) return null;
		const raw = xmlText.trim();
		if (!raw) return null;
		try {
			const doc = parseGenericXmlDocument(raw);
			return { doc };
		} catch {
			return null;
		}
	}, [open, xmlText]);

	useEffect(() => {
		if (!open) {
			setMapping(defaultGenericXmlFieldMapping());
			setSelectedTag('');
			setRecordIndex(0);
			setPathFilter('');
			setTagCounts([]);
			setParseError(null);
			return;
		}
		if (!parsed) return;
		setParseError(null);
		try {
			const counts = collectXmlTagCounts(parsed.doc);
			setTagCounts(counts);
			setSelectedTag((prev) => {
				if (prev && counts.some((c) => c.name === prev)) return prev;
				const best =
					counts.find(
						(t) => t.count > 1 && !['wrapper', 'root', 'listing', 'listings'].includes(t.name.toLowerCase()),
					) ?? counts[0];
				return best?.name ?? '';
			});
		} catch (e: unknown) {
			setParseError(e instanceof Error ? e.message : 'XML-Fehler');
		}
	}, [open, parsed]);

	const records = useMemo(() => {
		if (!parsed?.doc || !selectedTag) return [];
		return listRecordElements(parsed.doc, selectedTag);
	}, [parsed, selectedTag]);

	useEffect(() => {
		setRecordIndex(0);
	}, [selectedTag, parsed?.doc]);

	useEffect(() => {
		if (recordIndex >= records.length) setRecordIndex(Math.max(0, records.length - 1));
	}, [records.length, recordIndex]);

	const previewEl = records[recordIndex];

	const paths: XmlPathSample[] = useMemo(() => {
		if (!previewEl) return [];
		return collectRelativePathsFromRecord(previewEl);
	}, [previewEl]);

	useEffect(() => {
		if (!open || !parsed?.doc || !selectedTag) return;
		const first = listRecordElements(parsed.doc, selectedTag)[0];
		if (!first) return;
		setMapping(guessMappingFromPaths(collectRelativePathsFromRecord(first).map((p) => p.path)));
	}, [open, parsed?.doc, selectedTag]);

	const filteredPaths = useMemo(() => {
		const q = pathFilter.trim().toLowerCase();
		if (!q) return paths;
		return paths.filter((p) => p.path.toLowerCase().includes(q) || p.sample.toLowerCase().includes(q));
	}, [paths, pathFilter]);

	const treeSlice = useMemo(() => filteredPaths.slice(0, TREE_PATH_CAP), [filteredPaths]);
	const pathTreeRoots = useMemo(() => buildXmlPathTree(treeSlice), [treeSlice]);

	const previewListing = useMemo(() => {
		if (!previewEl) return null;
		try {
			return listingInputFromMappedRecord(previewEl, mapping, {
				fallbackTitle: `Datensatz ${recordIndex + 1}`,
			});
		} catch {
			return null;
		}
	}, [previewEl, mapping, recordIndex]);

	const appendToken = useCallback((key: keyof GenericXmlFieldMapping, token: string) => {
		setMapping((prev) => {
			const cur = prev[key];
			const sep = cur.trim().length && !cur.endsWith(' ') && !token.startsWith(' ') ? ' ' : '';
			return { ...prev, [key]: cur + sep + token };
		});
	}, []);

	const onDropField = useCallback(
		(key: keyof GenericXmlFieldMapping, e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOverKey(null);
			const raw = (
				e.dataTransfer.getData('text/plain').trim() ||
				e.dataTransfer.getData('text/uri-list').trim() ||
				e.dataTransfer.getData('text').trim()
			);
			if (!raw) return;
			const token = raw.includes('{{') ? raw : tokenForDrag(raw);
			appendToken(key, token);
		},
		[appendToken],
	);

	const fieldDnDHandlers = useCallback(
		(key: keyof GenericXmlFieldMapping) => ({
			onDragEnter: (e: DragEvent) => {
				const can =
					Array.from(e.dataTransfer.types).includes('text/plain') ||
					Array.from(e.dataTransfer.types).includes('Text');
				if (can) {
					e.preventDefault();
					setDragOverKey(key);
				}
			},
			onDragOver: (e: DragEvent) => {
				e.preventDefault();
				e.stopPropagation();
				const dt = e.dataTransfer;
				const can =
					Array.from(dt.types).includes('text/plain') || Array.from(dt.types).includes('Text');
				if (can) {
					dt.dropEffect = 'copy';
					setDragOverKey(key);
				}
			},
			onDragLeave: (e: DragEvent) => {
				const rel = e.relatedTarget as Node | null;
				if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) {
					setDragOverKey((k) => (k === key ? null : k));
				}
			},
			onDrop: (e: DragEvent) => onDropField(key, e),
		}),
		[onDropField],
	);

	const onPathClick = useCallback(
		(path: string) => {
			const k = lastFocusedKey ?? 'title';
			appendToken(k, tokenForDrag(path));
		},
		[appendToken, lastFocusedKey],
	);

	const handleApply = useCallback(() => {
		if (!parsed?.doc || !selectedTag || !records.length) return;
		const out: ListingInput[] = [];
		for (const el of records) {
			out.push(
				listingInputFromMappedRecord(el, mapping, {
					fallbackTitle: 'Immobilie',
				}),
			);
		}
		onApply(out);
	}, [parsed, selectedTag, records, mapping, onApply]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-[2px]"
			role="presentation"
			onClick={(e) => {
				if ((e.target as HTMLElement).closest('[data-generic-xml-sheet]')) return;
				onClose();
			}}
		>
			<div
				data-generic-xml-sheet
				className="glass-card relative z-[1] flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden shadow-strong"
				role="dialog"
				aria-labelledby="generic-xml-title"
			>
				<div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4">
					<div>
						<h2 id="generic-xml-title" className="text-lg font-semibold text-primary">
							Feldzuordnung mit Vorschau
						</h2>
						<p className="mt-1 text-muted text-xs">
							Wiederholenden Knoten wählen und Platzhalter{' '}
							<code className="rounded bg-slate-800/10 px-1 font-mono">{'{{pfad}}'}</code> von rechts per Klick oder per
							Ziehen&nbsp;&amp; Ablegen direkt ins Eingabefeld (nicht nur den Rand) — die Zelle leuchtet beim Darüberziehen.
							Vergleichbar mit dem Zuordnungsschritt bei WP&nbsp;All&nbsp;Import (ohne WordPress).
						</p>
					</div>
					<button type="button" className="btn btn-ghost shrink-0 text-sm" onClick={onClose}>
						Schließen
					</button>
				</div>

				<div className="scrollbar-thin grid min-h-[18rem] flex-1 gap-0 overflow-hidden md:grid-cols-[1fr,minmax(280px,360px)]">
					<div className="scrollbar-thin overflow-y-auto border-r border-slate-200/80 p-5">
						{parseError ? (
							<p className="text-red-700 text-sm">{parseError}</p>
						) : !parsed ? (
							<p className="text-muted text-sm">Kein gültiges XML geladen.</p>
						) : (
							<>
								<div className="mb-5 flex flex-wrap items-end gap-4">
									<label className="block min-w-[12rem] text-sm font-medium text-slate-800">
										Wiederholendes Element
										<select
											value={selectedTag}
											onChange={(e) => setSelectedTag(e.target.value)}
											className={`${fieldInputCls()} mt-1 !font-sans`}
										>
											{tagCounts.map((t) => (
												<option key={t.name} value={t.name}>
													{t.name} ({t.count}× im Dokument)
												</option>
											))}
										</select>
									</label>
									<div className="flex items-center gap-2 text-sm font-medium text-slate-700">
										<button
											type="button"
											disabled={!records.length}
											className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-45"
											onClick={() => setRecordIndex((i) => Math.max(0, i - 1))}
										>
											⟨
										</button>
										<span className="min-w-[5rem] text-center font-mono text-xs">
											{records.length ? recordIndex + 1 : 0} / {records.length}
										</span>
										<button
											type="button"
											disabled={!records.length}
											className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-45"
											onClick={() => setRecordIndex((i) => Math.min(records.length - 1, i + 1))}
										>
											⟩
										</button>
										<button
											type="button"
											onClick={() => {
												const el = records[0];
												if (!el) return;
												setMapping(guessMappingFromPaths(collectRelativePathsFromRecord(el).map((p) => p.path)));
											}}
											disabled={!records.length}
											className="rounded-lg border border-amber-200/90 bg-accent/15 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-accent/25 disabled:opacity-45"
										>
											Vorschläge aus Pfaden
										</button>
									</div>
								</div>

								<div className="space-y-4">
									{MAP_KEYS.map((row) => {
										const dnd = fieldDnDHandlers(row.key);
										const dropRing =
											dragOverKey === row.key
												? 'ring-2 ring-amber-400/90 ring-offset-2 ring-offset-white/80'
												: '';
										return (
											<label
												key={row.key}
												className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
											>
												{row.label}
												{row.helper ? (
													<span className="block font-normal lowercase text-slate-400 first-letter:uppercase">
														{row.helper}
													</span>
												) : null}
												{row.multiline ? (
													<textarea
														value={mapping[row.key]}
														onChange={(e) => setMapping((m) => ({ ...m, [row.key]: e.target.value }))}
														onFocus={() => setLastFocusedKey(row.key)}
														onDragEnter={dnd.onDragEnter}
														onDragOver={dnd.onDragOver}
														onDragLeave={dnd.onDragLeave}
														onDrop={dnd.onDrop}
														draggable={false}
														rows={row.rows ?? 3}
														className={`${fieldInputCls(true)} transition-shadow ${dropRing}`}
														placeholder="Pfad von rechts hierher ziehen oder tippen…"
														spellCheck={false}
													/>
												) : (
													<input
														type="text"
														value={mapping[row.key]}
														onChange={(e) => setMapping((m) => ({ ...m, [row.key]: e.target.value }))}
														onFocus={() => setLastFocusedKey(row.key)}
														onDragEnter={dnd.onDragEnter}
														onDragOver={dnd.onDragOver}
														onDragLeave={dnd.onDragLeave}
														onDrop={dnd.onDrop}
														draggable={false}
														className={`${fieldInputCls(false)} transition-shadow ${dropRing}`}
														spellCheck={false}
													/>
												)}
											</label>
										);
									})}
								</div>

								<div className="mt-6 rounded-xl border border-accent/35 bg-accent/10 p-4">
									<h3 className="text-sm font-semibold text-amber-950">Vorschau (aktueller Datensatz)</h3>
									{previewListing ? (
										<dl className="mt-3 grid gap-2 font-mono text-[11px] text-slate-800 sm:grid-cols-2">
											<dt className="text-slate-500">title</dt>
											<dd>{previewListing.title.slice(0, 120)}{previewListing.title.length > 120 ? '…' : ''}</dd>
											<dt className="text-slate-500">priceEuro</dt>
											<dd>{previewListing.priceEuro != null ? String(previewListing.priceEuro) : '—'}</dd>
											<dt className="text-slate-500">city / zip</dt>
											<dd>{previewListing.city} · {previewListing.zip}</dd>
											<dt className="text-slate-500">externalId</dt>
											<dd>{previewListing.externalId ?? '—'}</dd>
											<dt className="text-slate-500">images</dt>
											<dd>{previewListing.images?.length ?? 0} URL(s)</dd>
										</dl>
									) : (
										<p className="mt-2 text-muted text-xs">Keine Elemente gefunden oder Mapping ungültig.</p>
									)}
								</div>
							</>
						)}
					</div>

					<div className="scrollbar-thin flex flex-col gap-3 overflow-y-auto bg-slate-50/85 p-4">
						<div>
							<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quelle (Repeater / Baum)</h3>
							<p className="mt-1 text-[11px] leading-relaxed text-slate-500">
								Verschachtelte Gruppen sind einklappbar (wie ACF‑Repeater/Unterfelder). 								Platzhalter wie{' '}
								<code className="rounded bg-white/80 px-0.5 font-mono text-[10px]">picture[0]/url</code> per Klick oder
								auf ein linkes Zielfeld ziehen (Eingabefeld oder mehrzeiliges Feld).
							</p>
						</div>
						<input
							value={pathFilter}
							onChange={(e) => setPathFilter(e.target.value)}
							className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-300"
							placeholder="Pfad oder Wert suchen …"
							type="search"
						/>
						<div className="scrollbar-thin min-h-[12rem] flex-1 overflow-y-auto rounded-lg border border-slate-200/80 bg-white/50 p-2">
							<NestedPathTree nodes={pathTreeRoots} depth={0} onPathClick={onPathClick} />
						</div>
						{filteredPaths.length > TREE_PATH_CAP ? (
							<p className="text-[10px] text-slate-500">
								Baum aus den ersten {TREE_PATH_CAP.toLocaleString('de-DE')} Treffern — Suche eingrenzen.
							</p>
						) : null}
					</div>
				</div>

				<div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200/80 px-5 py-4">
					<a
						className="mr-auto font-medium text-amber-950 text-xs underline decoration-amber-300/70 underline-offset-2 hover:text-accent-950"
						href="https://www.wpallimport.com/documentation/wp-all-import-in-depth-overview/"
						target="_blank"
						rel="noopener noreferrer"
					>
						WP&nbsp;All&nbsp;Import Überblick
					</a>
					<button type="button" className="btn btn-ghost" onClick={onClose}>
						Abbrechen
					</button>
					<button
						type="button"
						disabled={!records.length || !parsed}
						className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-muted disabled:opacity-50"
						onClick={handleApply}
					>
						Übernehmen&nbsp;&amp; Prüfen
					</button>
				</div>
			</div>
		</div>
	);
}
