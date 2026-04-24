"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import {
  updateUserRoleAsAgency,
  removeUserFromOrgAsAgency,
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
};

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

export function TeamPanel({ members }: { members: Member[] }) {
  if (members.length === 0) {
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
      {members.map((m) => (
        <li key={m.id}>
          <MemberRow member={m} />
        </li>
      ))}
    </ul>
  );
}

function MemberRow({ member }: { member: Member }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(member.role);

  const isPending = member.clerkUserId.startsWith("seed_pending_");
  const displayName =
    [member.firstName, member.lastName].filter(Boolean).join(" ") || null;

  function onRoleChange(next: UserRole) {
    if (next === role) return;
    setError(null);
    const prev = role;
    setRole(next); // optimistic
    startTransition(async () => {
      const res = await updateUserRoleAsAgency({ userId: member.id, role: next });
      if (!res.ok) {
        setError(res.error);
        setRole(prev);
      }
    });
  }

  function onRemove() {
    if (!confirm(`Remove ${member.email} from this tenant? This revokes their portal access immediately.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await removeUserFromOrgAsAgency({ userId: member.id });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {displayName || member.email}
          </span>
          {isPending ? (
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
        onChange={(e) => onRoleChange(e.target.value as UserRole)}
        disabled={pending}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {ALL_ROLES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        className="text-[11px] text-destructive hover:underline underline-offset-2 disabled:opacity-40"
      >
        {pending ? "…" : "Remove"}
      </button>
    </div>
  );
}
