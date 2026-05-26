"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  autoMapColumns,
  applyMapping,
  parseCsvRaw,
  MARKETPLACE_FIELDS,
  type ColumnMapping,
  type MarketplaceField,
} from "@/lib/marketplace/csv-mapping";
import type { CsvRow } from "@/lib/marketplace/csv-client";

// ---------------------------------------------------------------------------
// SellerImportWizard — 5-step import flow:
//
//   1. Source       Pick CSV upload OR Cursive audience segment
//   2. Upload       Drop the file (CSV) / paste segment id (Cursive)
//   3. Map columns  Auto-detected mapping with per-row override (CSV only —
//                   Cursive has a fixed shape so it skips to step 4)
//   4. Deduplicate  3-bucket preview against the seller's existing leads.
//                   Per-row toggle to skip exact-matches and possible-dups.
//   5. Import       Final commit + summary screen with link back to dashboard
//
// Modeled after the VendScout pattern — progress bar + step header at top,
// content card below, Back / Next CTAs at bottom. Cursive path collapses
// steps 3 + 4 because there's no column mapping (fixed shape) and dedup is
// handled by the replenish pipeline.
// ---------------------------------------------------------------------------

type Step = "source" | "upload" | "map" | "dedup" | "import";

type Source = "csv" | "cursive";

interface DedupRowResult {
  rowIndex: number;
  bucket: "new" | "exact-match" | "possible-dup";
  reason: string;
  matches: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  }>;
  row: CsvRow;
}

interface DedupPreviewSummary {
  total: number;
  newCount: number;
  exactMatchCount: number;
  possibleDupCount: number;
  results: DedupRowResult[];
}

interface ImportSummary {
  fetched: number;
  upserted: number;
  expired: number;
  skipped: number;
  errors: string[];
}

const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "Choose source" },
  { id: "upload", label: "Upload file" },
  { id: "map", label: "Map columns" },
  { id: "dedup", label: "Deduplication" },
  { id: "import", label: "Import" },
];

export function SellerImportWizard() {
  const router = useRouter();

  // Top-level wizard state.
  const [step, setStep] = React.useState<Step>("source");
  const [source, setSource] = React.useState<Source | null>(null);

  // CSV-path state.
  const [file, setFile] = React.useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = React.useState<string[]>([]);
  const [rawRows, setRawRows] = React.useState<string[][]>([]);
  const [mappings, setMappings] = React.useState<ColumnMapping[]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Dedup state.
  const [preview, setPreview] = React.useState<DedupPreviewSummary | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  // Per-row inclusion override. Defaults: new=true, exact-match=false, possible-dup=false.
  const [includeRow, setIncludeRow] = React.useState<Record<number, boolean>>({});

  // Submit state.
  const [submitting, setSubmitting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportSummary | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Cursive-path state.
  const [cursiveConfig, setCursiveConfig] = React.useState({
    name: "",
    segmentId: "",
    kind: "CURSIVE_AUDIENCE" as "CURSIVE_AUDIENCE" | "CURSIVE_SEGMENT",
    defaultPropertyType: "SALE" as "RENTAL" | "SALE" | "INVESTMENT" | "COMMERCIAL",
    defaultMarket: "United States",
  });
  const [cursiveResult, setCursiveResult] = React.useState<{
    sourceId: string;
    summary: { fetchedCount: number; upsertedCount: number; newCount: number };
  } | null>(null);

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  const visibleSteps: Step[] =
    source === "cursive"
      ? ["source", "upload", "dedup", "import"] // collapse "map"
      : STEPS.map((s) => s.id);

  const currentIndex = visibleSteps.indexOf(step);
  const totalSteps = visibleSteps.length;
  const progress = ((currentIndex + 1) / totalSteps) * 100;

  const goBack = () => {
    const prev = visibleSteps[currentIndex - 1];
    if (prev) setStep(prev);
  };
  const goNext = () => {
    const next = visibleSteps[currentIndex + 1];
    if (next) setStep(next);
  };

  // -------------------------------------------------------------------------
  // CSV file → raw parse → auto-map
  // -------------------------------------------------------------------------

  async function handleFile(f: File) {
    setFile(f);
    setParseError(null);
    setPreview(null);
    setImportResult(null);
    try {
      const text = await f.text();
      const parsed = parseCsvRaw(text);
      if (parsed.headers.length === 0) {
        setParseError("CSV is empty or missing a header row.");
        return;
      }
      setRawHeaders(parsed.headers);
      setRawRows(parsed.rows);
      const auto = autoMapColumns({
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 25),
      });
      setMappings(auto.mappings);
    } catch (err) {
      setParseError((err as Error).message);
    }
  }

  function updateMapping(idx: number, field: MarketplaceField | null) {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === idx
          ? { ...m, marketplaceField: field, confidence: "name-match" }
          : m,
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Dedup preview — runs when we enter step "dedup" with a valid CSV
  // -------------------------------------------------------------------------

  const runDedupPreview = React.useCallback(async () => {
    if (source !== "csv") return;
    const csvRows = applyMapping(mappings, rawRows);
    if (csvRows.length === 0) {
      setParseError(
        "Mapped rows contain no leads with email or phone — at least one identity column must be mapped.",
      );
      return;
    }
    setPreviewing(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/marketplace/seller/import-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: csvRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error ?? "Preview failed");
        return;
      }
      const p = data.preview as DedupPreviewSummary;
      setPreview(p);
      // Default inclusions: new rows ON, exact + possible OFF.
      const defaults: Record<number, boolean> = {};
      for (const r of p.results) {
        defaults[r.rowIndex] = r.bucket === "new";
      }
      setIncludeRow(defaults);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setPreviewing(false);
    }
  }, [mappings, rawRows, source]);

  // Auto-fire the preview when the user reaches the dedup step.
  React.useEffect(() => {
    if (step === "dedup" && source === "csv" && !preview && !previewing) {
      void runDedupPreview();
    }
  }, [step, source, preview, previewing, runDedupPreview]);

  // -------------------------------------------------------------------------
  // CSV final submit
  // -------------------------------------------------------------------------

  async function submitCsvImport() {
    if (!preview) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Only include rows the user has flagged as ON.
      const rowsToImport = preview.results
        .filter((r) => includeRow[r.rowIndex])
        .map((r) => r.row);

      if (rowsToImport.length === 0) {
        setSubmitError("No rows selected for import.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/marketplace/seller/import-csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: rowsToImport }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error ?? "Import failed");
        return;
      }
      setImportResult(data.summary);
      setStep("import");
      router.refresh();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Cursive submit
  // -------------------------------------------------------------------------

  async function submitCursiveImport() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/marketplace/seller/import-cursive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cursiveConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error ?? "Sync failed");
        return;
      }
      setCursiveResult(data);
      setStep("import");
      router.refresh();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <ProgressHeader
        steps={visibleSteps.map((id) => STEPS.find((s) => s.id === id)!)}
        currentIndex={currentIndex}
        progress={progress}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        {step === "source" && (
          <StepSource
            source={source}
            onPick={(s) => {
              setSource(s);
              setStep("upload");
            }}
          />
        )}
        {step === "upload" && source === "csv" && (
          <StepUploadCsv
            file={file}
            rowCount={rawRows.length}
            parseError={parseError}
            onFile={handleFile}
          />
        )}
        {step === "upload" && source === "cursive" && (
          <StepUploadCursive config={cursiveConfig} onChange={setCursiveConfig} />
        )}
        {step === "map" && source === "csv" && (
          <StepMap
            mappings={mappings}
            onUpdate={updateMapping}
          />
        )}
        {step === "dedup" && source === "csv" && (
          <StepDedup
            preview={preview}
            previewing={previewing}
            includeRow={includeRow}
            onToggle={(rowIndex, value) =>
              setIncludeRow((prev) => ({ ...prev, [rowIndex]: value }))
            }
            submitError={submitError}
          />
        )}
        {step === "dedup" && source === "cursive" && (
          <StepCursiveConfirm
            config={cursiveConfig}
            submitError={submitError}
          />
        )}
        {step === "import" && (
          <StepImportSummary
            csvSummary={importResult}
            cursiveSummary={cursiveResult}
            error={submitError}
          />
        )}
      </div>

      {step !== "import" ? (
        <WizardFooter
          step={step}
          source={source}
          canGoBack={currentIndex > 0}
          canGoNext={canGoNext(step, source, file, mappings, preview, cursiveConfig)}
          onBack={goBack}
          onNext={goNext}
          onSubmit={
            (step === "dedup" && source === "csv") ? submitCsvImport :
            (step === "dedup" && source === "cursive") ? submitCursiveImport :
            null
          }
          submitting={submitting || previewing}
        />
      ) : null}
    </div>
  );
}

// ===========================================================================
// Step components
// ===========================================================================

function StepSource({
  source,
  onPick,
}: {
  source: Source | null;
  onPick: (s: Source) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Choose source</h2>
      <p className="mt-1 text-sm text-slate-600">
        How do you want to bring leads into the marketplace?
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <SourceCard
          active={source === "csv"}
          onClick={() => onPick("csv")}
          icon="📄"
          title="CSV upload"
          description="Drop a spreadsheet from your overflow inbox or CRM. We'll auto-detect the columns + dedupe against your existing leads."
        />
        <SourceCard
          active={source === "cursive"}
          onClick={() => onPick("cursive")}
          icon="🔗"
          title="Audience segment"
          description="Wire an identity-resolution audience by ID. Auto-refreshes weekly and continuously feeds new leads into the marketplace."
        />
      </div>
    </div>
  );
}

function SourceCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left rounded-xl border p-5 transition-colors",
        active
          ? "border-emerald-500 bg-emerald-50/50"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg mb-3 text-xl"
        style={{ background: active ? "#10B981" : "#F1F5F9" }}
      >
        <span>{icon}</span>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>
    </button>
  );
}

function StepUploadCsv({
  file,
  rowCount,
  parseError,
  onFile,
}: {
  file: File | null;
  rowCount: number;
  parseError: string | null;
  onFile: (f: File) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Upload your CSV</h2>
      <p className="mt-1 text-sm text-slate-600">
        Max 5,000 rows per upload. We'll auto-detect the columns on the next step.
      </p>
      <label className="mt-6 block w-full p-10 text-center cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 transition-colors">
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <p className="text-base font-medium text-slate-900">
          {file ? file.name : "Click to choose a CSV file"}
        </p>
        {rowCount > 0 ? (
          <p className="mt-2 text-xs uppercase tracking-widest font-bold text-emerald-700">
            {rowCount.toLocaleString()} rows parsed
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">or drag and drop</p>
        )}
      </label>
      {parseError ? (
        <p className="mt-3 text-sm text-red-700">{parseError}</p>
      ) : null}
    </div>
  );
}

function StepUploadCursive({
  config,
  onChange,
}: {
  config: {
    name: string;
    segmentId: string;
    kind: "CURSIVE_AUDIENCE" | "CURSIVE_SEGMENT";
    defaultPropertyType: "RENTAL" | "SALE" | "INVESTMENT" | "COMMERCIAL";
    defaultMarket: string;
  };
  onChange: (c: typeof config) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">
        Wire an audience segment
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Connect an existing identity-resolution audience. Replenishes weekly.
      </p>
      <div className="mt-6 space-y-4">
        <Field label="Display name" hint="Internal label for your dashboard.">
          <input
            type="text"
            value={config.name}
            onChange={(e) => onChange({ ...config, name: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm"
            placeholder="Texas high-intent buyers"
          />
        </Field>
        <Field label="Segment ID" hint="UUID from the audience source.">
          <input
            type="text"
            value={config.segmentId}
            onChange={(e) => onChange({ ...config, segmentId: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm font-mono"
            placeholder="ba8c9817-f91c-4955-b2b0-53b933a15f7d"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Property type">
            <select
              value={config.defaultPropertyType}
              onChange={(e) =>
                onChange({
                  ...config,
                  defaultPropertyType: e.target.value as typeof config.defaultPropertyType,
                })
              }
              className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm"
            >
              <option value="SALE">Sale</option>
              <option value="RENTAL">Rental</option>
              <option value="INVESTMENT">Investment</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
          </Field>
          <Field label="Default market">
            <input
              type="text"
              value={config.defaultMarket}
              onChange={(e) =>
                onChange({ ...config, defaultMarket: e.target.value })
              }
              className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function StepMap({
  mappings,
  onUpdate,
}: {
  mappings: ColumnMapping[];
  onUpdate: (idx: number, field: MarketplaceField | null) => void;
}) {
  const mapped = mappings.filter((m) => m.marketplaceField !== null).length;
  const skipped = mappings.length - mapped;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Map your columns</h2>
      <p className="mt-1 text-sm text-slate-600">
        We auto-detected {mapped} of {mappings.length} columns. Review and adjust as needed.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Badge color="emerald">{mapped} mapped</Badge>
        <Badge color="slate">{skipped} skipped</Badge>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500 font-semibold">
            <tr>
              <th className="text-left px-4 py-3 w-[28%]">Your CSV column</th>
              <th className="text-left px-4 py-3 w-[26%]">Marketplace field</th>
              <th className="text-left px-4 py-3">Sample data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mappings.map((m, i) => (
              <tr key={`${m.sourceHeader}-${i}`}>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-slate-900">
                    {m.sourceHeader}
                  </div>
                  {m.confidence === "name-match" || m.confidence === "sample-detect" ? (
                    <Badge color="emerald" small>auto</Badge>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top">
                  <select
                    value={m.marketplaceField ?? ""}
                    onChange={(e) =>
                      onUpdate(
                        i,
                        (e.target.value as MarketplaceField) || null,
                      )
                    }
                    className="h-9 w-full max-w-[220px] px-2 rounded-md border border-slate-300 bg-white text-sm"
                  >
                    <option value="">-- Skip this column --</option>
                    {MARKETPLACE_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {humanField(f)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">
                  <div className="text-xs space-y-0.5 max-w-md">
                    {m.sampleValues.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      m.sampleValues.map((v, j) => (
                        <div key={j} className="truncate">
                          {v}
                        </div>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepDedup({
  preview,
  previewing,
  includeRow,
  onToggle,
  submitError,
}: {
  preview: DedupPreviewSummary | null;
  previewing: boolean;
  includeRow: Record<number, boolean>;
  onToggle: (rowIndex: number, value: boolean) => void;
  submitError: string | null;
}) {
  if (previewing || !preview) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-slate-600">Checking against your existing leads…</p>
      </div>
    );
  }

  const selectedCount = Object.values(includeRow).filter(Boolean).length;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Deduplication preview</h2>
      <p className="mt-1 text-sm text-slate-600">
        We checked every row against your existing leads. Review the matches below — toggle anything you want to import anyway.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge color="emerald">+ {preview.newCount} New</Badge>
        <Badge color="amber">↻ {preview.exactMatchCount} Exact matches</Badge>
        <Badge color="orange">⚠ {preview.possibleDupCount} Possible duplicates</Badge>
        <span className="ml-auto text-xs text-slate-500">
          {selectedCount} selected for import
        </span>
      </div>

      {submitError ? (
        <p className="mt-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      <div className="mt-6 space-y-5">
        <DedupGroup
          title="New records"
          icon="+"
          color="emerald"
          rows={preview.results.filter((r) => r.bucket === "new")}
          includeRow={includeRow}
          onToggle={onToggle}
          emptyText="No new records — every row matched an existing lead."
        />
        <DedupGroup
          title="Exact matches"
          icon="↻"
          color="amber"
          rows={preview.results.filter((r) => r.bucket === "exact-match")}
          includeRow={includeRow}
          onToggle={onToggle}
          emptyText="No exact matches found."
        />
        <DedupGroup
          title="Possible duplicates"
          icon="⚠"
          color="orange"
          rows={preview.results.filter((r) => r.bucket === "possible-dup")}
          includeRow={includeRow}
          onToggle={onToggle}
          emptyText="No possible duplicates found."
        />
      </div>
    </div>
  );
}

function DedupGroup({
  title,
  icon,
  color,
  rows,
  includeRow,
  onToggle,
  emptyText,
}: {
  title: string;
  icon: string;
  color: "emerald" | "amber" | "orange";
  rows: DedupRowResult[];
  includeRow: Record<number, boolean>;
  onToggle: (rowIndex: number, value: boolean) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          {icon} {title} (0)
        </h3>
        <p className="text-xs text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-2">
        {icon} {title} ({rows.length})
      </h3>
      <div className="rounded-lg border border-slate-200 max-h-[320px] overflow-y-auto divide-y divide-slate-100">
        {rows.map((r) => (
          <div
            key={r.rowIndex}
            className="p-3 flex items-start justify-between gap-3"
          >
            <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                checked={!!includeRow[r.rowIndex]}
                onChange={(e) => onToggle(r.rowIndex, e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900 font-medium">
                  {leadLabel(r.row)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{r.reason}</div>
                {r.matches.length > 0 ? (
                  <div className="mt-1.5 text-xs text-slate-400 bg-slate-50 rounded px-2 py-1 inline-block">
                    matches: {leadLabel(r.matches[0])}
                  </div>
                ) : null}
              </div>
            </label>
            <span
              className={[
                "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded shrink-0",
                color === "emerald" && "bg-emerald-100 text-emerald-700",
                color === "amber" && "bg-amber-100 text-amber-700",
                color === "orange" && "bg-orange-100 text-orange-700",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {title.split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepCursiveConfirm({
  config,
  submitError,
}: {
  config: {
    name: string;
    segmentId: string;
    defaultPropertyType: string;
    defaultMarket: string;
  };
  submitError: string | null;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Confirm + sync</h2>
      <p className="mt-1 text-sm text-slate-600">
        We'll wire this audience and pull the first batch now. Future replenish
        runs happen weekly. Dedup against your existing leads is handled by the
        replenish pipeline.
      </p>
      <dl className="mt-6 space-y-2 text-sm">
        <Row label="Name" value={config.name || "—"} />
        <Row label="Segment ID" value={config.segmentId || "—"} mono />
        <Row label="Property type" value={config.defaultPropertyType} />
        <Row label="Market" value={config.defaultMarket} />
      </dl>
      {submitError ? (
        <p className="mt-3 text-sm text-red-700">{submitError}</p>
      ) : null}
    </div>
  );
}

function StepImportSummary({
  csvSummary,
  cursiveSummary,
  error,
}: {
  csvSummary: ImportSummary | null;
  cursiveSummary: {
    sourceId: string;
    summary: { fetchedCount: number; upsertedCount: number; newCount: number };
  } | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-red-700">Import failed</h2>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (csvSummary) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          ✓ Import complete
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {csvSummary.upserted.toLocaleString()} leads added to your inventory.
        </p>
        <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Imported" value={csvSummary.upserted} color="emerald" />
          <Stat label="Below floor" value={csvSummary.expired} color="amber" />
          <Stat label="Skipped" value={csvSummary.skipped} color="slate" />
          <Stat label="Errors" value={csvSummary.errors.length} color="red" />
        </dl>
        {csvSummary.errors.length > 0 ? (
          <details className="mt-4">
            <summary className="text-xs text-slate-600 cursor-pointer">
              View error details
            </summary>
            <ul className="mt-2 text-xs text-red-700 space-y-1">
              {csvSummary.errors.slice(0, 20).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="mt-6 flex gap-2">
          <a
            href="/marketplace/seller"
            className="inline-flex items-center px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium"
          >
            Back to dashboard
          </a>
          <a
            href="/marketplace/seller/import"
            className="inline-flex items-center px-4 py-2 rounded-md border border-slate-300 text-sm font-medium"
          >
            Import more
          </a>
        </div>
      </div>
    );
  }
  if (cursiveSummary) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          ✓ Audience wired
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The source is connected and the first batch has been pulled.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Fetched" value={cursiveSummary.summary.fetchedCount} color="slate" />
          <Stat label="Upserted" value={cursiveSummary.summary.upsertedCount} color="emerald" />
          <Stat label="New" value={cursiveSummary.summary.newCount} color="emerald" />
        </dl>
        <div className="mt-6">
          <a
            href="/marketplace/seller"
            className="inline-flex items-center px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }
  return null;
}

// ===========================================================================
// Shared UI bits
// ===========================================================================

function ProgressHeader({
  steps,
  currentIndex,
  progress,
}: {
  steps: { id: Step; label: string }[];
  currentIndex: number;
  progress: number;
}) {
  return (
    <div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="mt-4 flex items-start justify-between">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.id} className="flex-1 flex flex-col items-center text-center">
              <span
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2",
                  done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : active
                      ? "bg-white border-emerald-500 text-emerald-700"
                      : "bg-slate-100 border-slate-200 text-slate-500",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={[
                  "mt-2 text-xs font-medium",
                  active ? "text-slate-900" : "text-slate-500",
                ].join(" ")}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WizardFooter({
  step,
  source,
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  onSubmit,
  submitting,
}: {
  step: Step;
  source: Source | null;
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: (() => void) | null;
  submitting: boolean;
}) {
  const isFinal = step === "dedup";
  void source;
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack || submitting}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        ← Back
      </button>

      {isFinal && onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canGoNext || submitting}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Importing…" : "Import data →"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || submitting}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Next →
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900">{label}</label>
      {hint ? <p className="text-xs text-slate-500 mb-1.5">{hint}</p> : null}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={[
          "col-span-2 text-slate-900",
          mono ? "font-mono text-xs" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function Badge({
  children,
  color,
  small,
}: {
  children: React.ReactNode;
  color: "emerald" | "amber" | "orange" | "slate" | "red";
  small?: boolean;
}) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    orange: "bg-orange-100 text-orange-800",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-700",
  }[color];
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-semibold",
        small ? "text-[10px] px-1.5 py-0.5 mt-1 uppercase tracking-widest" : "text-xs px-2.5 py-1",
        cls,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "slate" | "red";
}) {
  const cls = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    slate: "text-slate-700",
    red: "text-red-700",
  }[color];
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
        {label}
      </div>
      <div className={["text-2xl font-semibold tabular-nums mt-1", cls].join(" ")}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function canGoNext(
  step: Step,
  source: Source | null,
  file: File | null,
  mappings: ColumnMapping[],
  preview: DedupPreviewSummary | null,
  cursiveConfig: { name: string; segmentId: string },
): boolean {
  if (step === "source") return source !== null;
  if (step === "upload" && source === "csv") return !!file && mappings.length > 0;
  if (step === "upload" && source === "cursive")
    return (
      cursiveConfig.name.trim().length > 0 &&
      cursiveConfig.segmentId.trim().length > 0
    );
  if (step === "map")
    return mappings.some(
      (m) => m.marketplaceField === "email" || m.marketplaceField === "phone",
    );
  if (step === "dedup" && source === "csv") return preview !== null;
  if (step === "dedup" && source === "cursive") return true;
  return false;
}

function humanField(f: MarketplaceField): string {
  return f
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function leadLabel(r: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
  const contact = r.email || r.phone || "—";
  return name ? `${name} · ${contact}` : contact;
}
