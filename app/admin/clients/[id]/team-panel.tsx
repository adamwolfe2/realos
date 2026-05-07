"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import {
  updateUserRoleAsAgency,
  removeUserFromOrgAsAgency,
  updatePropertyAccessAsAgency,
} from "@/lib/actions/manage-team";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  clerkUserId: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  // Property-level access. Empty = unrestricted (org-wide).
  // Non-empty = locked to those properties only. From
  // UserPropertyAccess rows.
  propertyIds: string[];
};

type Property = { id: string; name: string };

const CLIENT_ROLES: Array<{ value: UserRole; label: string }> = [
  { value: UserRole.CLIENT_OWNER, label: "Owner" },
  { value: UserRole.CLIENT_ADMIN, label: "Admin" },
  { value: UserRole.CLIENT_VIEWER, label: "Viewer" },
  { value: UserRole.LEASING_AGENT, label: "Leasing agent" },
];

const AGENCY_ROLES: Array<{ value: UserRole; label: string }> = [
  { value: UserRole.AGENCY_OWNER, label: "Agency owner" },
  { value: UserRole.AGENCY_ADMIN, label: "Agency admin" },
  { value: UserRole.AGENCY_OPERATOR, label: "Agency operator" },
];

const ALL_ROLES = [...CLIENT_ROLES, ...AGENCY_ROLES];

const AGENCY_ROLE_SET: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

export function TeamPanel({
  members,
  properties,
}: {
  members: Member[];
  properties: Property[];
}) {
  const [rows, setRows] = useState<Member[]>(members);
  const showPropertyControls = properties.length > 1;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
        <p className="text-sm text-foreground font-medium">No team members yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click &quot;Invite user&quot; above to send the first invite.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-card">
      {rows.map((m) => (
        <li key={m.id}>
          <MemberRow
            member={m}
            properties={properties}
            showPropertyControls={showPropertyControls}
            onRemove={(id) =>
              setRows((prev) => prev.filter((x) => x.id !== id))
            }
            onRoleChange={(id, role) =>
              setRows((prev) =>
                prev.map((x) => (x.id === id ? { ...x, role } : x)),
              )
            }
            onPropertyAccessChange={(id, propertyIds) =>
              setRows((prev) =>
                prev.map((x) => (x.id === id ? { ...x, propertyIds } : x)),
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  properties,
  showPropertyControls,
  onRemove,
  onRoleChange,
  onPropertyAccessChange,
}: {
  member: Member;
  properties: Property[];
  showPropertyControls: boolean;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: UserRole) => void;
  onPropertyAccessChange: (id: string, propertyIds: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(member.role);
  const [accessOpen, setAccessOpen] = useState(false);

  const isPending = member.clerkUserId.startsWith("seed_pending_");
  const isAgency = AGENCY_ROLE_SET.has(member.role);
  const displayName =
    [member.firstName, member.lastName].filter(Boolean).join(" ") || null;

  function onRoleChangeAction(next: UserRole) {
    if (next === role) return;
    setError(null);
    const prev = role;
    setRole(next);
    startTransition(async () => {
      const res = await updateUserRoleAsAgency({ userId: member.id, role: next });
      if (!res.ok) {
        setError(res.error);
        setRole(prev);
      } else {
        onRoleChange(member.id, next);
      }
    });
  }

  function onRemove_() {
    if (
      !confirm(
        `Remove ${member.email} from this tenant? This revokes their portal access immediately.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await removeUserFromOrgAsAgency({ userId: member.id });
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
          {isAgency ? (
            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-medium">
              Agency
            </span>
          ) : isPending ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium">
              Pending invite
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
        onChange={(e) => onRoleChangeAction(e.target.value as UserRole)}
        disabled={pending}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {ALL_ROLES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {!isAgency && showPropertyControls ? (
        <button
          type="button"
          onClick={() => setAccessOpen((v) => !v)}
          className="text-[11px] font-medium text-primary hover:underline underline-offset-2"
          title="Edit which properties this teammate can see"
        >
          {member.propertyIds.length === 0
            ? "All properties"
            : member.propertyIds.length === 1
              ? "1 property"
              : `${member.propertyIds.length} properties`}
          {" • edit"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove_}
        disabled={pending}
        className="text-[11px] text-destructive hover:underline underline-offset-2 disabled:opacity-40"
      >
        {pending ? "…" : "Remove"}
      </button>
      {accessOpen && !isAgency && showPropertyControls ? (
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

// Mirrors the operator-facing version in
// app/portal/settings/team-panel.tsx but calls the *Agency* server
// action so the agency can edit any tenant's user scopes from the
// admin panel. Empty selection = unrestricted (org-wide).
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
      const res = await updatePropertyAccessAsAgency({
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
        Leave nothing checked to give this teammate org-wide access.
        Otherwise they will only see data for the properties you tick.
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
