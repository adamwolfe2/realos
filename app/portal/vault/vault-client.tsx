"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Pencil,
  ExternalLink,
  AlertTriangle,
  Loader2,
  KeyRound,
} from "lucide-react";
import {
  createCredential,
  updateCredential,
  deleteCredential,
  revealCredential,
  importCredentialsFromCsv,
  generatePasswordAction,
} from "@/lib/actions/vault";

// ---------------------------------------------------------------------------
// Vault — client interactivity
//
// Listens for "new credential" / "import CSV" clicks from the server-
// rendered header buttons via custom DOM events, owns the modal state,
// and orchestrates every reveal / copy-to-clipboard with the auto-clear
// timer the PRD calls for.
//
// Plaintext lifecycle on the client:
//   - Reveal modal holds plaintext in React state for max 30 sec
//   - Closing the modal clears it from state immediately
//   - Copy-to-clipboard schedules a 30 sec follow-up that overwrites
//     the clipboard with an empty string (best-effort — some browsers
//     deny clipboard writes without a user gesture, in which case the
//     plaintext stays until the user copies something else)
// ---------------------------------------------------------------------------

const REVEAL_TIMEOUT_MS = 30_000;

type Entry = {
  id: string;
  name: string;
  platform: string | null;
  websiteUrl: string | null;
  username: string | null;
  notes: string | null;
  tags: string[];
  propertyId: string | null;
  property: { id: string; name: string } | null;
  lastRevealedAt: string | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Property = { id: string; name: string };

export function VaultClient({
  entries,
  properties,
}: {
  entries: Entry[];
  properties: Property[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Entry | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [revealing, setRevealing] = React.useState<Entry | null>(null);
  const [filter, setFilter] = React.useState("");
  const [propertyFilter, setPropertyFilter] = React.useState<string>("");

  // Wire the server-rendered header buttons to client state via the
  // data-vault-action attribute. Avoids prop-drilling client state up
  // into the server page.
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest(
        "[data-vault-action]",
      );
      if (!target) return;
      const action = target.getAttribute("data-vault-action");
      if (action === "new") setNewOpen(true);
      if (action === "import") setImportOpen(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const filtered = entries.filter((e) => {
    if (propertyFilter && e.propertyId !== propertyFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.platform ?? "").toLowerCase().includes(q) ||
      (e.username ?? "").toLowerCase().includes(q) ||
      (e.websiteUrl ?? "").toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <>
      {/* Filter row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
        <input
          type="text"
          placeholder="Search by name, platform, username, tag…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
        />
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">All properties</option>
          <option value="__org">Org-wide only</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {entries.length === 0
              ? "No credentials yet"
              : "No credentials match your filter"}
          </p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {entries.length === 0
              ? "Click \"New credential\" to add one by hand, or \"Import CSV\" to bulk-load from a spreadsheet."
              : "Try clearing the search or property filter."}
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Platform</th>
              <th className="px-4 py-2 text-left font-medium">Property</th>
              <th className="px-4 py-2 text-left font-medium">Username</th>
              <th className="px-4 py-2 text-left font-medium">Password</th>
              <th className="px-4 py-2 text-left font-medium">Last revealed</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr
                key={entry.id}
                className="border-t border-border hover:bg-muted/20"
              >
                <td className="px-4 py-2 font-medium text-foreground">
                  {entry.name}
                  {entry.websiteUrl ? (
                    <a
                      href={entry.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 inline-flex text-muted-foreground hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.platform ?? "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.property?.name ?? (
                    <span className="text-muted-foreground/60">Org-wide</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.username ?? "—"}
                </td>
                <td className="px-4 py-2 font-mono text-muted-foreground">
                  ••••••••••
                </td>
                <td className="px-4 py-2 text-[11px] text-muted-foreground">
                  {entry.lastRevealedAt ? relativeFromNow(entry.lastRevealedAt) : "never"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setRevealing(entry)}
                      title="Reveal password"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      title="Edit"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <DeleteButton
                      id={entry.id}
                      name={entry.name}
                      onDeleted={() => router.refresh()}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {revealing ? (
        <RevealModal entry={revealing} onClose={() => setRevealing(null)} />
      ) : null}
      {newOpen ? (
        <EditorModal
          mode="create"
          properties={properties}
          onClose={() => setNewOpen(false)}
        />
      ) : null}
      {editing ? (
        <EditorModal
          mode="edit"
          entry={editing}
          properties={properties}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {importOpen ? (
        <ImportModal
          properties={properties}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Reveal modal — plaintext lifecycle managed here
// ---------------------------------------------------------------------------

function RevealModal({
  entry,
  onClose,
}: {
  entry: Entry;
  onClose: () => void;
}) {
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "ready"; password: string; username: string | null }
    | { kind: "error"; message: string }
  >({ kind: "loading" });
  const [remaining, setRemaining] = React.useState(REVEAL_TIMEOUT_MS / 1000);
  const [copied, setCopied] = React.useState<null | "password" | "username">(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await revealCredential(entry.id);
        if (cancelled) return;
        if (r.ok && r.data) {
          setState({
            kind: "ready",
            password: r.data.password,
            username: r.data.username,
          });
        } else {
          setState({
            kind: "error",
            message: r.ok ? "Unknown error" : r.error,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Reveal failed",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  React.useEffect(() => {
    if (state.kind !== "ready") return;
    const interval = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          // Auto-close. Clearing state to "loading" then onClose blanks
          // plaintext from React memory before the modal unmounts.
          setState({ kind: "loading" });
          onClose();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.kind, onClose]);

  async function copy(value: string, what: "password" | "username") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
      // Best-effort clipboard self-clear after 30 sec. Browsers may
      // deny without a user gesture; we accept that constraint and
      // rely on the auto-close to limit the plaintext lifetime.
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => undefined);
      }, REVEAL_TIMEOUT_MS);
    } catch {
      // Clipboard API unavailable (older Safari over http). User can
      // still triple-click to select. Surface no error — the password
      // is visible on screen either way.
    }
  }

  return (
    <Modal onClose={onClose} width="md">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">
          {entry.name}
        </h2>
        {entry.platform || entry.property ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {entry.platform ?? ""}
            {entry.platform && entry.property ? " · " : ""}
            {entry.property?.name ?? ""}
          </p>
        ) : null}
      </div>

      <div className="px-6 py-5 space-y-3">
        {state.kind === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Decrypting…
          </div>
        ) : state.kind === "error" ? (
          <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertTriangle className="h-4 w-4" />
            {state.message}
          </div>
        ) : (
          <>
            {state.username ? (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Username
                </p>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm">
                  <span className="flex-1 break-all">{state.username}</span>
                  <button
                    type="button"
                    onClick={() => copy(state.username!, "username")}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {copied === "username" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copy
                  </button>
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Password
              </p>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm">
                <span className="flex-1 break-all">{state.password}</span>
                <button
                  type="button"
                  onClick={() => copy(state.password, "password")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {copied === "password" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-closing in {remaining}s · clipboard auto-clears in 30s ·
              this reveal was logged
            </p>
          </>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Editor modal — create + edit
// ---------------------------------------------------------------------------

function EditorModal({
  mode,
  entry,
  properties,
  onClose,
}: {
  mode: "create" | "edit";
  entry?: Entry;
  properties: Property[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(entry?.name ?? "");
  const [platform, setPlatform] = React.useState(entry?.platform ?? "");
  const [websiteUrl, setWebsiteUrl] = React.useState(entry?.websiteUrl ?? "");
  const [username, setUsername] = React.useState(entry?.username ?? "");
  const [password, setPassword] = React.useState("");
  const [notes, setNotes] = React.useState(entry?.notes ?? "");
  const [propertyId, setPropertyId] = React.useState(entry?.propertyId ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  async function onGenerate() {
    const pwd = await generatePasswordAction(24);
    setPassword(pwd);
    setShowPassword(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      name,
      platform: platform || undefined,
      websiteUrl: websiteUrl || undefined,
      username: username || undefined,
      ...(password ? { password } : {}),
      notes: notes || undefined,
      tags: [] as string[],
      propertyId: propertyId || null,
    };
    try {
      const r =
        mode === "create"
          ? await createCredential(payload)
          : await updateCredential(entry!.id, payload);
      if (r.ok) {
        router.refresh();
        onClose();
      } else {
        setError(r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal onClose={onClose} width="lg">
      <form onSubmit={onSubmit}>
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "create" ? "New credential" : `Edit "${entry?.name}"`}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          ) : null}

          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Google Analytics 4 — Telegraph Commons"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <input
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="google-ads, meta-ads, appfolio, bank…"
                className="input"
              />
            </Field>
            <Field label="Property">
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="input"
              >
                <option value="">Org-wide (any property)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Login URL">
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://ads.google.com"
              className="input"
            />
          </Field>

          <Field label="Username / email">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="hello@telegraphcommons.com"
              className="input"
            />
          </Field>

          <Field
            label={mode === "create" ? "Password" : "Password (leave blank to keep)"}
            required={mode === "create"}
          >
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={mode === "create"}
                placeholder={mode === "edit" ? "•••••••• (unchanged)" : ""}
                autoComplete="new-password"
                className="input flex-1 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/40"
                title={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onGenerate}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
              >
                Generate
              </button>
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Recovery email, MFA seed location, who set this up, etc."
              className="input"
            />
          </Field>
        </div>

        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Save credential"
                : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CSV import modal
// ---------------------------------------------------------------------------

function ImportModal({
  properties,
  onClose,
}: {
  properties: Property[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [csvText, setCsvText] = React.useState("");
  const [defaultPropertyId, setDefaultPropertyId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<null | {
    created: number;
    skipped: number;
    errors: string[];
  }>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const r = await importCredentialsFromCsv({
        csvText,
        defaultPropertyId: defaultPropertyId || null,
      });
      if (r.ok && r.data) {
        setResult(r.data);
        router.refresh();
      } else {
        setError(r.ok ? "Unknown error" : r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal onClose={onClose} width="lg">
      <form onSubmit={onSubmit}>
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Import credentials from CSV
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Required columns: <code>name, password</code>. Optional:{" "}
            <code>url, username, notes, platform, property_slug</code>. First
            row must be the header.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          ) : null}
          {result ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <p className="font-medium">
                Imported {result.created} credentials · skipped{" "}
                {result.skipped}
              </p>
              {result.errors.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer">
                    {result.errors.length} errors
                  </summary>
                  <ul className="mt-1 list-disc pl-5">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}

          <Field label="Default property (optional)">
            <select
              value={defaultPropertyId}
              onChange={(e) => setDefaultPropertyId(e.target.value)}
              className="input"
            >
              <option value="">Org-wide unless property_slug specified</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="CSV content" required>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              required
              placeholder={`name,platform,url,username,password,notes\nGA4 Telegraph,google-analytics,https://analytics.google.com,hello@example.com,super-secret,MFA via authy`}
              className="input font-mono text-xs"
            />
          </Field>
        </div>

        <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Anything inside the CSV is encrypted before it hits the DB.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
            >
              {result ? "Done" : "Cancel"}
            </button>
            {!result ? (
              <button
                type="submit"
                disabled={pending || !csvText.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending ? "Importing…" : "Import"}
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function DeleteButton({
  id,
  name,
  onDeleted,
}: {
  id: string;
  name: string;
  onDeleted: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  async function onDelete() {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setPending(true);
    try {
      const r = await deleteCredential(id);
      if (r.ok) onDeleted();
      else alert(r.error);
    } finally {
      setPending(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      title="Delete"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Modal({
  children,
  onClose,
  width = "md",
}: {
  children: React.ReactNode;
  onClose: () => void;
  width?: "md" | "lg";
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxWidth = width === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidth} rounded-xl border border-border bg-card shadow-xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function relativeFromNow(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}
