"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  previewSegmentMembers,
  type MaskedMember,
} from "@/lib/actions/audiences";
import { Eye, Mail, MapPin, Phone, ShieldCheck, User } from "lucide-react";

const PREVIEW_COUNT = 5;

export function MemberPreview({ segmentId }: { segmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [members, setMembers] = useState<MaskedMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  function handlePreview() {
    setError(null);
    setTouched(true);
    startTransition(async () => {
      const result = await previewSegmentMembers(segmentId, PREVIEW_COUNT);
      if (!result.ok) {
        setMembers(null);
        setError(result.error);
        return;
      }
      setMembers(result.members);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-xl">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Names, emails, and phone numbers are masked here for privacy. Full
            details only ship to the destination you push to.
          </p>
        </div>
        <Button
          type="button"
          onClick={handlePreview}
          disabled={pending}
          size="sm"
          variant="secondary"
          className="rounded-md"
        >
          <Eye />
          {pending
            ? "Loading…"
            : touched
              ? `Refresh ${PREVIEW_COUNT} members`
              : `Preview ${PREVIEW_COUNT} members`}
        </Button>
      </div>

      {pending ? <PreviewSkeleton count={PREVIEW_COUNT} /> : null}

      {!pending && error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      {!pending && !error && members && members.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No members returned by AudienceLab.
        </p>
      ) : null}

      {!pending && !error && members && members.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m, i) => (
            <MemberCard key={i} member={m} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemberCard({ member }: { member: MaskedMember }) {
  const name = formatName(member);
  const location = formatLocation(member);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <User className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {name ?? "Anonymous"}
          </p>
          {location ? (
            <p className="text-[11px] text-muted-foreground truncate">
              {location}
            </p>
          ) : null}
        </div>
      </div>
      <dl className="mt-3 space-y-1.5">
        <Field icon={<Mail className="h-3 w-3" />} value={member.email} />
        <Field icon={<Phone className="h-3 w-3" />} value={member.phone} />
        <Field
          icon={<MapPin className="h-3 w-3" />}
          value={formatPostal(member)}
        />
      </dl>
    </div>
  );
}

function Field({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span
        className={
          value
            ? "text-foreground font-mono truncate"
            : "text-muted-foreground italic"
        }
      >
        {value ?? "Not provided"}
      </span>
    </div>
  );
}

function PreviewSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-border bg-card p-4 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-2.5 w-1/2 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2.5 w-3/4 rounded bg-muted" />
            <div className="h-2.5 w-1/2 rounded bg-muted" />
            <div className="h-2.5 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatName(m: MaskedMember): string | null {
  const parts = [m.firstName, m.lastName].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  if (parts.length === 0) return null;
  return parts.join(" ");
}

function formatLocation(m: MaskedMember): string | null {
  const cityState = [m.city, m.state]
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join(", ");
  if (cityState && m.country) return `${cityState} • ${m.country}`;
  if (cityState) return cityState;
  return m.country ?? null;
}

function formatPostal(m: MaskedMember): string | null {
  if (!m.postalCode) return null;
  return m.country ? `${m.postalCode} (${m.country})` : m.postalCode;
}
