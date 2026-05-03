import { useEffect, useState } from 'react';

import type { AdriomParseResult } from '../../lib/xml/parseAdriom';
import type { ListingInput } from '../../lib/types';

export type XmlImportStagingRowAdriom = {
	format: 'adriom';
	rowKey: string;
	checked: boolean;
	errors: string[];
	warnings: string[];
	payload: ListingInput & { firestoreDocumentId: string };
};

export type XmlImportStagingRowOpenImmo = {
	format: 'openimmo';
	rowKey: string;
	checked: boolean;
	errors: string[];
	warnings: string[];
	listing: ListingInput;
};

export type XmlImportStagingRow = XmlImportStagingRowAdriom | XmlImportStagingRowOpenImmo;

export type XmlStagingState =
	| {
			format: 'adriom';
			feedMeta: AdriomParseResult['feedMeta'];
			rows: XmlImportStagingRowAdriom[];
	  }
	| {
			format: 'openimmo';
			rows: XmlImportStagingRowOpenImmo[];
	  };

function listingFromRow(row: XmlImportStagingRow): ListingInput {
	return row.format === 'adriom' ? row.payload : row.listing;
}

function previewTitle(row: XmlImportStagingRow): string {
	const t = listingFromRow(row).title?.trim();
	return t || 'Ohne Titel';
}

function previewCity(row: XmlImportStagingRow): string {
	const li = listingFromRow(row);
	return [li.zip?.trim(), li.city?.trim(), li.country?.trim()].filter(Boolean).join(' · ') || '—';
}

function previewStreet(row: XmlImportStagingRow): string {
	const li = listingFromRow(row);
	const s = [li.street?.trim(), li.zip?.trim()].filter(Boolean).join(', ');
	return s || '—';
}

function previewPriceEuro(row: XmlImportStagingRow): number | undefined {
	const p = listingFromRow(row).priceEuro;
	return p != null && Number.isFinite(p) ? p : undefined;
}

function previewImageCount(row: XmlImportStagingRow): number {
	const li = listingFromRow(row);
	return Array.isArray(li.images) ? li.images.length : 0;
}

function firstImageUrl(row: XmlImportStagingRow): string | null {
	const li = listingFromRow(row);
	const u = li.images?.[0]?.trim();
	return u || null;
}

function docLabel(row: XmlImportStagingRow): string {
	if (row.format === 'adriom') return row.payload.firestoreDocumentId || '—';
	return row.listing.externalId?.trim() || 'Neuer Datensatz';
}

function blocking(row: XmlImportStagingRow): boolean {
	return row.errors.length > 0;
}

function truncateText(s: string, max: number): string {
	const t = s.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1).trim()}…`;
}

export type XmlPrepareProgress = { done: number; total: number };

export type XmlImportReviewDialogProps = {
	open: boolean;
	staging: XmlStagingState | null;
	/** Rohdaten werden noch eingelesen / validiert (Dialog schon offen). */
	loading?: boolean;
	/** Fortschritt beim zeilenweisen Aufbau (damit das UI nicht „einfriert“). */
	prepareProgress?: XmlPrepareProgress | null;
	busy?: boolean;
	onClose: () => void;
	onChangeRowChecked: (rowKey: string, checked: boolean) => void;
	onSelectOnlyValid: () => void;
	onDeselectAll: () => void;
	onConfirmImport: () => void;
};

export function XmlImportReviewDialog(props: XmlImportReviewDialogProps) {
	const {
		open,
		staging,
		loading = false,
		prepareProgress = null,
		busy = false,
		onClose,
		onChangeRowChecked,
		onSelectOnlyValid,
		onDeselectAll,
		onConfirmImport,
	} = props;

	const rows = staging?.rows ?? ([] as XmlImportStagingRow[]);
	const [previewIndex, setPreviewIndex] = useState(0);
	const [jumpValue, setJumpValue] = useState('');

	useEffect(() => {
		setPreviewIndex(0);
		setJumpValue('');
	}, [staging]);

	useEffect(() => {
		if (rows.length && previewIndex >= rows.length) setPreviewIndex(Math.max(0, rows.length - 1));
	}, [rows.length, previewIndex]);

	useEffect(() => {
		if (!open || typeof document === 'undefined') return;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	useEffect(() => {
		if (!open) return undefined;
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
			if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && staging && rows.length && !busy && !loading) {
				if (e.key === 'ArrowLeft') setPreviewIndex((i) => Math.max(0, i - 1));
				else setPreviewIndex((i) => Math.min(rows.length - 1, i + 1));
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [open, onClose, staging, rows.length, busy, loading]);

	if (!open) return null;

	const selectedOk = rows.filter((r) => r.checked && !blocking(r)).length;
	const selectedForced = rows.filter((r) => r.checked && blocking(r)).length;
	const selectableCount = rows.filter((r) => !blocking(r)).length;
	const blockingCount = rows.filter((r) => blocking(r)).length;

	let feedSummary: string | null = null;
	if (staging?.format === 'adriom') {
		const m = staging.feedMeta;
		feedSummary = [
			m.source?.trim() ? `Quelle: ${String(m.source)}` : '',
			m.sourceUrl?.trim() ? String(m.sourceUrl) : '',
			m.generated?.trim() ? `Stand: ${String(m.generated)}` : '',
			m.count?.trim() ? `Anzahl lt. Feed: ${String(m.count)}` : '',
		]
			.filter(Boolean)
			.join(' · ');
	}

	const showSpinner = loading && !staging;
	const currentRow = rows.length ? rows[previewIndex]! : null;
	const li = currentRow ? listingFromRow(currentRow) : null;
	const firstImg = currentRow ? firstImageUrl(currentRow) : null;
	const pct =
		prepareProgress && prepareProgress.total > 0
			? Math.round((prepareProgress.done / prepareProgress.total) * 100)
			: 0;

	function goJump() {
		const n = parseInt(jumpValue, 10);
		if (!Number.isFinite(n) || rows.length === 0) return;
		const clamped = Math.min(Math.max(1, n), rows.length);
		setPreviewIndex(clamped - 1);
		setJumpValue('');
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
			onClick={(e) => {
				if ((e.target as HTMLElement).closest('[data-xml-dialog-sheet]')) return;
				if (!busy) onClose();
			}}
			role="presentation"
			aria-modal="true"
		>
			<div
				data-xml-dialog-sheet
				className="glass-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-6 shadow-strong"
				role="dialog"
				aria-labelledby="xml-import-dialog-title"
			>
				<div className="flex flex-shrink-0 items-start justify-between gap-4">
					<div>
						<h2 id="xml-import-dialog-title" className="text-xl font-semibold text-primary">
							XML-Übernahme prüfen
						</h2>
						<p className="mt-2 text-secondary text-xs">
							{showSpinner ? (
								<>Datensätze werden eingelesen …</>
							) : staging?.format === 'adriom' ? (
								<>
									Adriom-Feed ({rows.length} Einträge)
									{feedSummary ? <> · {feedSummary}</> : null}
								</>
							) : staging ? (
								<>OpenImmo ({rows.length} Einträge)</>
							) : (
								<>—</>
							)}
						</p>
						<p className="mt-2 text-muted text-[11px]">
							Jeweils{' '}
							<strong>eine Vorschau</strong> mit Blättern (wie WP All‑Import): weniger Arbeitsspeicher, die Seite bleibt
							bedienbar.
						</p>
						{(loading || prepareProgress) && prepareProgress ? (
							<div className="mt-3 w-full max-w-md">
								<div className="mb-1 flex justify-between font-medium text-muted text-[11px]">
									<span>Zeilen vorbereiten</span>
									<span>
										{prepareProgress.done.toLocaleString('de-DE')} / {prepareProgress.total.toLocaleString('de-DE')}{' '}
										({pct}%)
									</span>
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-surface-2)_80%,transparent)]">
									<div
										className="h-full rounded-full bg-accent transition-[width] duration-150"
										style={{ width: `${pct}%` }}
									/>
								</div>
							</div>
						) : null}
					</div>
					<button type="button" className="btn btn-ghost shrink-0" disabled={busy} onClick={onClose}>
						Schließen
					</button>
				</div>

				<div className="border-border glass-subtle mx-[-1.35rem] my-4 flex-shrink-0 border-y px-[1.35rem] py-4">
					<div className="flex flex-wrap gap-2">
						<button type="button" className="btn btn-ghost rounded-full text-[11px]" disabled={busy || showSpinner} onClick={onSelectOnlyValid}>
							Nur ohne Fehler auswählen
						</button>
						<button type="button" className="btn btn-ghost rounded-full text-[11px]" disabled={busy || showSpinner} onClick={onDeselectAll}>
							Alle abwählen
						</button>
					</div>
					<p className="mt-3 text-muted text-[11px]">
						{showSpinner ? (
							'…'
						) : (
							<>
								{selectableCount} ohne kritische Meldungen · {blockingCount} mit Fehlern · Ausgewählt:{' '}
								<strong className="text-primary">
									{selectedOk}
									{selectedForced ? ` (${selectedForced} trotz Fehler)` : ''}
								</strong>
								<span className="text-muted"> · Pfeiltasten ← → zum Blättern</span>
							</>
						)}
					</p>
				</div>

				<div className="scrollbar-thin min-h-[12rem] flex-1 overflow-y-auto">
					{showSpinner ? (
						<div className="flex flex-col items-center justify-center gap-6 py-16">
							<div
								className="h-12 w-12 animate-spin rounded-full border-[3px] border-accent border-t-transparent"
								aria-hidden="true"
							/>
							<p className="text-center font-medium text-secondary text-sm">
								Datei wird geparst und Zeilen werden geprüft … das kann bei großen Feeds einen Moment dauern.
							</p>
						</div>
					) : currentRow && li ? (
						<div className="space-y-4 pb-4">
							<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[color-mix(in_oklab,var(--color-surface-2)_35%,transparent)] px-4 py-3">
								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										className="btn btn-outline px-4 py-2 text-xs"
										disabled={busy || previewIndex <= 0}
										onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
									>
										← Zurück
									</button>
									<button
										type="button"
										className="btn btn-outline px-4 py-2 text-xs"
										disabled={busy || previewIndex >= rows.length - 1}
										onClick={() => setPreviewIndex((i) => Math.min(rows.length - 1, i + 1))}
									>
										Weiter →
									</button>
									<span className="mono text-primary text-xs">
										<span className="font-semibold">{previewIndex + 1}</span> / {rows.length}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<label className="flex items-center gap-1.5 font-medium text-muted text-[11px]">
										Zeile
										<input
											type="number"
											min={1}
											max={rows.length}
											value={jumpValue}
											onChange={(e) => setJumpValue(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && goJump()}
											className="glass-subtle mono w-[4.5rem] rounded-lg border border-border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-accent"
											placeholder={String(previewIndex + 1)}
										/>
										<button type="button" className="btn btn-ghost py-1 text-[11px]" disabled={busy} onClick={goJump}>
											Gehe zu
										</button>
									</label>
								</div>
							</div>

							<label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${blocking(currentRow) ? 'border-accent/50 bg-[color-mix(in_oklab,_red_6%,transparent)]' : 'border-border glass-subtle'}`}>
								<input
									type="checkbox"
									className="checkbox mt-1"
									disabled={busy}
									checked={currentRow.checked}
									onChange={(e) => onChangeRowChecked(currentRow.rowKey, (e.target as HTMLInputElement).checked)}
									aria-label={`Importieren: ${previewTitle(currentRow)}`}
								/>
								<span className="text-secondary text-sm">
									Dieses Objekt beim Übernehmen <strong>einschließen</strong>
								</span>
							</label>

							<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
								<div className="min-w-0 space-y-2">
									<p className="break-words font-semibold text-primary text-lg">{previewTitle(currentRow)}</p>
									<dl className="grid gap-x-4 gap-y-1 text-secondary text-xs sm:grid-cols-[6rem_1fr]">
										<dt className="text-muted">ID</dt>
										<dd className="break-all font-mono">{docLabel(currentRow)}</dd>
										<dt className="text-muted">Ort</dt>
										<dd>{previewCity(currentRow)}</dd>
										<dt className="text-muted">Adresse</dt>
										<dd>{previewStreet(currentRow)}</dd>
										<dt className="text-muted">Typ</dt>
										<dd>{li.propertyType || '—'}</dd>
										<dt className="text-muted">Preis</dt>
										<dd className="font-medium">
											{previewPriceEuro(currentRow) != null
												? `${Math.round(previewPriceEuro(currentRow)!).toLocaleString('de-DE')} €`
												: 'Auf Anfrage'}
										</dd>
										<dt className="text-muted">Fläche / Zi.</dt>
										<dd>
											{li.livingSpaceSqm != null ? `${li.livingSpaceSqm} m²` : '—'}
											{li.rooms != null ? ` · ${li.rooms} Zimmer` : ''}
										</dd>
										<dt className="text-muted">Bilder</dt>
										<dd>{previewImageCount(currentRow)}</dd>
										<dt className="text-muted mt-2 sm:col-span-2">Quelle</dt>
										<dd className="sm:col-span-2">{staging?.format === 'adriom' ? 'Adriom' : 'OpenImmo'}</dd>
										<dt className="text-muted">Beschreibung</dt>
										<dd className="whitespace-pre-wrap break-words sm:col-span-1">
											{li.description?.trim()
												? truncateText(li.description, 900)
												: '—'}
										</dd>
									</dl>
								</div>

								<div className="flex flex-col gap-2">
									<p className="font-medium text-muted text-[11px] uppercase tracking-wide">Vorschaubild</p>
									{firstImg ? (
										<a
											href={firstImg}
											target="_blank"
											rel="noopener noreferrer"
											className="block overflow-hidden rounded-xl border border-border bg-[color-mix(in_oklab,var(--color-surface-2)_40%,transparent)]"
										>
											<img
												src={firstImg}
												alt=""
												className="h-32 w-full object-cover"
												loading="lazy"
												decoding="async"
											/>
										</a>
									) : (
										<div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border text-muted text-xs">
											Kein Bild
										</div>
									)}
								</div>
							</div>

							{(currentRow.errors.length > 0 || currentRow.warnings.length > 0) && (
								<div className="rounded-xl border border-border px-4 py-3">
									<p className="mb-2 font-semibold text-primary text-xs">Prüfhinweise</p>
									<ul className="list-inside space-y-1 text-[11px] marker:text-accent">
										{currentRow.errors.map((t, i) => (
											<li key={`e-${previewIndex}-${i}`} className="text-accent">
												{t}
											</li>
										))}
										{currentRow.warnings.map((t, i) => (
											<li key={`w-${previewIndex}-${i}`} className="text-muted">{t}</li>
										))}
									</ul>
								</div>
							)}
						</div>
					) : (
						<p className="py-12 text-center text-muted text-sm">Keine Einträge.</p>
					)}
				</div>

				<div className="mt-4 flex flex-shrink-0 flex-wrap justify-end gap-2 border-border border-t pt-4">
					<button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
						Abbrechen
					</button>
					<button
						type="button"
						className="btn bg-accent text-accent-foreground hover:opacity-[0.93]"
						disabled={busy || showSpinner || selectedOk + selectedForced === 0}
						onClick={onConfirmImport}
					>
						{NselectedLabel(selectedOk, selectedForced)}{busy ? '…' : ''}
					</button>
				</div>
			</div>
		</div>
	);
}

function NselectedLabel(ok: number, forced: number): string {
	const n = ok + forced;
	if (forced > 0) return `${n} Übernehmen (inkl. ${forced} mit Fehlern)`;
	return `${n} Übernehmen`;
}
