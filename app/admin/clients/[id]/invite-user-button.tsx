"use client";

import { useState, useTransition } from "react";

type Props = {
  orgId: string;
  clerkOrgId: string | null;
  suggestedEmail?: string | null;
  suggestedName?: string | null;
};

type ClientRole = "CLIENT_OWNER" | "CLIENT_ADMIN" | "CLIENT_VIEWER" | "LEASING_AGENT";

const ROLE_OPTIONS: Array<{ value: ClientRole; label: string; hint: string }> = [
  { value: "CLIENT_OWNER", label: "Owner", hint: "Full portal + billing access" },
  { value: "CLIENT_ADMIN", label: "Admin", hint: "Full portal, no billing" },
  { value: "CLIENT_VIEWER", label: "Viewer", hint: "Read-only" },
  { value: "LEASING_AGENT", label: "Leasing agent", hint: "Leads + tours" },
];

export function InviteUserButton({
  orgId,
  clerkOrgId,
  suggestedEmail,
  suggestedName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(suggestedEmail ?? "");
  const [name, setName] = useState(suggestedName ?? "");
  const [role, setRole] = useState<ClientRole>("CLIENT_OWNER");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const disabled = !clerkOrgId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/clients/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name: name || undefined,
            role,
            organizationId: orgId,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        if (body.clerkInviteSent === false) {
          setOkMsg(
            `User row created. Clerk email skipped (${body.clerkError ?? "unknown"}).`
          );
        } else {
          setOkMsg(`Invite sent to ${email}.`);
        }
        setEmail("");
        setName("");
        setTimeout(() => {
          setOpen(false);
          setOkMsg(null);
          window.location.reload();
        }, 1800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invite failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? "Clerk org not linked yet" : "Send a portal invite"}
        className="border border-border bg-card hover:border-primary/40 transition-colors px-4 py-2 text-xs font-semibold tracking-wide rounded disabled:opacity-40"
      >
        {open ? "Close" : "Invite user"}
      </button>

      {open && !disabled ? (
        <form
          onSubmit={submit}
          className="mt-2 w-[340px] rounded-lg border border-border bg-card p-3 space-y-2 text-left"
        >
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="norman@sgrealestateco.com"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              Full name <span className="normal-case text-muted-foreground/70">(optional)</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Norman Gensinger"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ClientRole)}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="submit"
              disabled={pending || !email}
              className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-40"
            >
              {pending ? "Sending…" : "Send invite"}
            </button>
            {okMsg ? (
              <span className="text-[11px] text-primary">{okMsg}</span>
            ) : error ? (
              <span className="text-[11px] text-destructive">{error}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Clerk delivers the email.
              </span>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}
