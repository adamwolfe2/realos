"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import {
  updateUserRoleAsClient,
  removeUserFromOrgAsClient,
} from "@/lib/actions/manage-team";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  clerkUserId: string;
  lastLoginAt: Date | null;
};

const CLIENT_ROLES: Array<{ value: UserRole; label: string; hint: string }> = [
  { value: UserRole.CLIENT_OWNER, label: "Owner", hint: "Full access + billing" },
  { value: UserRole.CLIENT_ADMIN, label: "Admin", hint: "Full portal, no billing" },
  { value: UserRole.CLIENT_VIEWER, label: "Viewer", hint: "Read-only" },
  { value: UserRole.LEASING_AGENT, label: "Leasing agent", hint: "Leads + tours" },
];

const AGENCY_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

type InviteState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; email: string }
  | { kind: "error"; message: string };

type Props = {
  members: Member[];
  orgId: string;
  canManage: boolean;
  viewerUserId: string;
};

export function ClientTeamPanel(props: Props) {
  const [members, setMembers] = useState(props.members);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {props.canManage
            ? "Invite teammates, adjust their role, or remove access. Changes take effect immediately."
            : "Only Owners and Admins can invite teammates or change roles."}
        </p>
        {props.canManage ? (
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            {inviteOpen ? "Close" : "Invite teammate"}
          </button>
        ) : null}
      </div>

      {inviteOpen && props.canManage ? (
        <InviteForm
          orgId={props.orgId}
          onSuccess={() => setInviteOpen(false)}
        />
      ) : null}

      {members.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
          <p className="text-sm text-foreground font-medium">
            Just you so far.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click Invite teammate above to send the first invite.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {members.map((m) => (
            <li key={m.id}>
              <MemberRow
                member={m}
                canManage={props.canManage}
                isSelf={m.id === props.viewerUserId}
                onRemove={(id) =>
                  setMembers((prev) => prev.filter((x) => x.id !== id))
                }
                onRoleChange={(id, role) =>
                  setMembers((prev) =>
                    prev.map((x) => (x.id === id ? { ...x, role } : x))
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MemberRow({
  member,
  canManage,
  isSelf,
  onRemove,
  onRoleChange,
}: {
  member: Member;
  canManage: boolean;
  isSelf: boolean;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: UserRole) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(member.role);

  const isPending = member.clerkUserId.startsWith("seed_pending_");
  const isAgency = AGENCY_ROLES.has(member.role);
  const displayName =
    [member.firstName, member.lastName].filter(Boolean).join(" ") || null;
  const disableControls = !canManage || isSelf || isAgency;

  function onRoleSelect(next: UserRole) {
    if (next === role) return;
    setError(null);
    const prev = role;
    setRole(next);
    startTransition(async () => {
      const res = await updateUserRoleAsClient({ userId: member.id, role: next });
      if (!res.ok) {
        setError(res.error);
        setRole(prev);
      } else {
        onRoleChange(member.id, next);
      }
    });
  }

  function onRemove_() {
    if (!confirm(`Remove ${member.email} from your team? They lose portal access immediately.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await removeUserFromOrgAsClient({ userId: member.id });
      if (res.ok) onRemove(member.id);
      else setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {displayName || member.email}
          </span>
          {isSelf ? (
            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-medium">
              You
            </span>
          ) : null}
          {isAgency ? (
            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-medium">
              Agency
            </span>
          ) : isPending ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium">
              Pending
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
              Active
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {member.email}
          {member.lastLoginAt
            ? ` · last seen ${new Date(member.lastLoginAt).toLocaleDateString()}`
            : " · never signed in"}
        </div>
        {error ? (
          <div className="text-[11px] text-destructive mt-1">{error}</div>
        ) : null}
      </div>
      <select
        value={role}
        onChange={(e) => onRoleSelect(e.target.value as UserRole)}
        disabled={pending || disableControls}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {CLIENT_ROLES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {isAgency ? (
          <option value={member.role}>{member.role.replace("_", " ").toLowerCase()}</option>
        ) : null}
      </select>
      {!disableControls ? (
        <button
          type="button"
          onClick={onRemove_}
          disabled={pending}
          className="text-[11px] text-destructive hover:underline underline-offset-2 disabled:opacity-40"
        >
          {pending ? "…" : "Remove"}
        </button>
      ) : null}
    </div>
  );
}

function InviteForm({
  orgId,
  onSuccess,
}: {
  orgId: string;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CLIENT_ADMIN);
  const [state, setState] = useState<InviteState>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
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
      // Surface email delivery failures even when the invite was created.
      if (!body.inviteEmailSent && body.inviteEmailError) {
        throw new Error(
          `Invite created but email failed: ${body.inviteEmailError}. Check Resend configuration.`
        );
      }
      const okEmail = email;
      setState({ kind: "ok", email: okEmail });
      setEmail("");
      setName("");
      setTimeout(() => {
        setState({ kind: "idle" });
        onSuccess();
        // Full reload to pull the new user into the list with fresh server-side data.
        window.location.reload();
      }, 1500);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Invite failed",
      });
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-border bg-muted/20 p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Full name <span className="normal-case text-muted-foreground/70">(optional)</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Role
        </span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
        >
          {CLIENT_ROLES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {opt.hint}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={state.kind === "sending" || !email}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40"
        >
          {state.kind === "sending" ? "Sending…" : "Send invite"}
        </button>
        {state.kind === "ok" ? (
          <span className="text-[11px] text-primary">Invite sent to {state.email}.</span>
        ) : state.kind === "error" ? (
          <span className="text-[11px] text-destructive">{state.message}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            They'll receive a branded email from hello@leasestack.co with a sign-up link.
          </span>
        )}
      </div>
    </form>
  );
}
