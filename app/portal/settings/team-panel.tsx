"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import {
  updateUserRoleAsClient,
  removeUserFromOrgAsClient,
  updatePropertyAccessAsClient,
} from "@/lib/actions/manage-team";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  clerkUserId: string;
  lastLoginAt: Date | null;
  // Property-level access. Empty = unrestricted (org-wide). Non-empty
  // = locked to those properties only. Sourced from UserPropertyAccess
  // rows in /portal/settings page.tsx.
  propertyIds: string[];
};

type Property = { id: string; name: string };

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
  | { kind: "ok"; email: string; inviteLink: string | null; emailSent: boolean }
  | { kind: "error"; message: string; inviteLink: string | null };

type Props = {
  members: Member[];
  properties: Property[];
  orgId: string;
  canManage: boolean;
  viewerUserId: string;
};

export function ClientTeamPanel(props: Props) {
  const [members, setMembers] = useState(props.members);
  const [inviteOpen, setInviteOpen] = useState(false);
  const showPropertyControls = props.properties.length > 1;

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
          properties={props.properties}
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
                properties={props.properties}
                showPropertyControls={showPropertyControls}
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
                onPropertyAccessChange={(id, propertyIds) =>
                  setMembers((prev) =>
                    prev.map((x) =>
                      x.id === id ? { ...x, propertyIds } : x,
                    ),
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
  properties,
  showPropertyControls,
  canManage,
  isSelf,
  onRemove,
  onRoleChange,
  onPropertyAccessChange,
}: {
  member: Member;
  properties: Property[];
  showPropertyControls: boolean;
  canManage: boolean;
  isSelf: boolean;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: UserRole) => void;
  onPropertyAccessChange: (id: string, propertyIds: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(member.role);
  const [accessOpen, setAccessOpen] = useState(false);

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
      {!disableControls && showPropertyControls ? (
        <button
          type="button"
          onClick={() => setAccessOpen((v) => !v)}
          className="text-[11px] font-medium text-primary hover:underline underline-offset-2"
        >
          {member.propertyIds.length === 0
            ? "All properties"
            : member.propertyIds.length === 1
              ? "1 property"
              : `${member.propertyIds.length} properties`}
          {" • edit"}
        </button>
      ) : null}
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
      {accessOpen && !disableControls && showPropertyControls ? (
        <div className="basis-full">
          <PropertyAccessEditor
            userId={member.id}
            email={member.email}
            properties={properties}
            initialPropertyIds={member.propertyIds}
            onClose={() => setAccessOpen(false)}
            onSaved={(ids) => {
              onPropertyAccessChange(member.id, ids);
              setAccessOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyAccessEditor — inline checkbox list for restricting a teammate
// to a subset of properties. Empty selection => unrestricted (org-wide
// access). The save action is the canonical "replace the whole list"
// shape of updatePropertyAccessAsClient.
// ---------------------------------------------------------------------------
function PropertyAccessEditor({
  userId,
  email,
  properties,
  initialPropertyIds,
  onClose,
  onSaved,
}: {
  userId: string;
  email: string;
  properties: Property[];
  initialPropertyIds: string[];
  onClose: () => void;
  onSaved: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialPropertyIds),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setError(null);
    const ids = [...selected];
    startTransition(async () => {
      const res = await updatePropertyAccessAsClient({
        userId,
        propertyIds: ids,
      });
      if (res.ok) {
        onSaved(ids);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-foreground">
          Property access — {email}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        Leave nothing checked to give org-wide access. Otherwise this user
        will only see data for the properties you tick.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
        {properties.map((p) => {
          const checked = selected.has(p.id);
          return (
            <label
              key={p.id}
              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.id)}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span className="truncate">{p.name}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <div className="mt-2 text-[11px] text-destructive">{error}</div>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {selected.size > 0 ? (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear (give org-wide access)
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {selected.size === 0
            ? "Org-wide"
            : `${selected.size} of ${properties.length} selected`}
        </span>
      </div>
    </div>
  );
}

function InviteForm({
  orgId,
  properties,
  onSuccess,
}: {
  orgId: string;
  properties: Property[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CLIENT_ADMIN);
  // When `null` the invitee gets org-wide access (current default).
  // When a Set, they get exactly those properties only — used for the
  // Telegraph Commons team scenario where the org has 70 properties
  // but the new teammate should only see one.
  const [restrictedPropertyIds, setRestrictedPropertyIds] = useState<
    Set<string> | null
  >(null);
  const [state, setState] = useState<InviteState>({ kind: "idle" });
  const showPropertyControls = properties.length > 1;

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
          // Only send propertyIds when the operator explicitly opted
          // into restriction. Omitting the key keeps legacy behavior
          // (org-wide access) so single-property orgs aren't affected.
          ...(restrictedPropertyIds && restrictedPropertyIds.size > 0
            ? { propertyIds: [...restrictedPropertyIds] }
            : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const inviteLink: string | null = body.inviteLink ?? null;
      // Email failed but the user + invite link are still valid — surface the
      // exact failure AND offer a copy-link fallback so the operator isn't
      // blocked by a transient Resend issue.
      if (!body.inviteEmailSent) {
        const message = body.inviteEmailError
          ? `Invite created but email failed: ${body.inviteEmailError}. Copy the link below to send manually.`
          : "Invite created but the email did not send. Copy the link below to send manually.";
        setState({ kind: "error", message, inviteLink });
        return;
      }
      const okEmail = email;
      setState({
        kind: "ok",
        email: okEmail,
        inviteLink,
        emailSent: true,
      });
      setEmail("");
      setName("");
      setTimeout(() => {
        setState({ kind: "idle" });
        onSuccess();
        // Full reload to pull the new user into the list with fresh server-side data.
        window.location.reload();
      }, 4000);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Invite failed",
        inviteLink: null,
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

      {/* Property scope. Optional and progressive: by default the
          invitee gets org-wide access (current behavior). Operator
          checks "Limit to specific properties" to reveal the
          checklist — important so we don't intimidate single-property
          orgs with a feature they don't need. */}
      {showPropertyControls ? (
        <div className="rounded-md border border-border bg-background px-3 py-2.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={restrictedPropertyIds !== null}
              onChange={(e) =>
                setRestrictedPropertyIds(e.target.checked ? new Set() : null)
              }
              className="h-3.5 w-3.5 accent-primary"
            />
            <span className="font-medium">
              Limit access to specific properties
            </span>
          </label>
          {restrictedPropertyIds !== null ? (
            <div className="mt-2 pl-5 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {properties.map((p) => {
                const checked = restrictedPropertyIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-2 py-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRestrictedPropertyIds((prev) => {
                          if (!prev) return prev;
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        })
                      }
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-1 pl-5 text-[11px] text-muted-foreground">
              Default: org-wide access. They&apos;ll see every property.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={state.kind === "sending" || !email}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40"
        >
          {state.kind === "sending" ? "Sending…" : "Send invite"}
        </button>
        {state.kind === "ok" ? (
          <span className="text-[11px] text-primary">
            Invite sent to {state.email}.
          </span>
        ) : state.kind === "error" ? (
          <span className="text-[11px] text-destructive max-w-md">
            {state.message}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            They&apos;ll receive a branded email from hello@leasestack.co with
            a sign-up link.
          </span>
        )}
      </div>

      {/* Copy-link fallback. Renders on success (so operator can DM the link
          as backup) and on failure (so a Resend hiccup doesn't block onboarding). */}
      {(state.kind === "ok" || state.kind === "error") && state.inviteLink ? (
        <CopyInviteLink link={state.inviteLink} />
      ) : null}
    </form>
  );
}

function CopyInviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Most browsers permit clipboard.writeText in user-gesture handlers; if
      // it fails, the link is still selectable in the input below.
    }
  }
  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Manual invite link
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-sm border border-border bg-muted/40 px-2 py-1 text-[11px] font-mono text-foreground"
      />
      <p className="text-[10px] text-muted-foreground leading-snug">
        Send this directly to the invitee if the email didn&apos;t arrive.
        The link signs them in to your team with the role above.
      </p>
    </div>
  );
}
