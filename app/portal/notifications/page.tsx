"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markAllRead,
  markNotificationRead,
  resolveNotification,
  snoozeNotification,
  unsnoozeNotification,
} from "@/lib/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  snoozedUntil: string | null;
  resolvedAt: string | null;
};

const KIND_COLOR: Record<string, string> = {
  lead_created: "bg-primary/10 text-primary",
  tour_scheduled: "bg-primary/10 text-primary",
  chatbot_lead: "bg-muted text-muted-foreground",
  integration_error: "bg-destructive/10 text-destructive",
  sync_complete: "bg-muted text-muted-foreground",
  ai_quota_warning: "bg-destructive/10 text-destructive",
  pacing_alert: "bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200",
  critical_insight: "bg-destructive/10 text-destructive",
  warning_insight: "bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200",
};

// Severity-coded left border. Mirrors AlertBanner's palette so rows visually
// rank from the page (red = critical, amber = warning, blue = info). Anything
// not classified gets no border so the feed stays calm.
const KIND_BORDER: Record<string, string> = {
  integration_error: "border-l-2 border-l-destructive",
  ai_quota_warning: "border-l-2 border-l-destructive",
  critical_insight: "border-l-2 border-l-destructive",
  pacing_alert: "border-l-2 border-l-amber-500",
  warning_insight: "border-l-2 border-l-amber-500",
  lead_created: "border-l-2 border-l-primary",
  tour_scheduled: "border-l-2 border-l-primary",
  chatbot_lead: "border-l-2 border-l-primary",
  sync_complete: "",
};

// Kinds that need explicit operator action — surface a Resolve button.
// Everything else relies on read state only.
const ACTIONABLE_KINDS = new Set([
  "integration_error",
  "ai_quota_warning",
  "critical_insight",
]);

type Filter = "all" | "unread" | "today" | "week";

function isSnoozed(n: Notification, now: number): boolean {
  if (!n.snoozedUntil) return false;
  return new Date(n.snoozedUntil).getTime() > now;
}

function applyFilter(items: Notification[], filter: Filter): Notification[] {
  const now = Date.now();
  // "all" surfaces everything including resolved + currently-snoozed rows
  // so operators can find what they snoozed and unsnooze if needed.
  if (filter === "all") return items;

  // All other filters hide resolved + currently-snoozed by default.
  const active = items.filter((n) => !n.resolvedAt && !isSnoozed(n, now));
  if (filter === "unread") return active.filter((n) => !n.readAt);
  const DAY_MS = 86_400_000;
  if (filter === "today") {
    return active.filter(
      (n) => now - new Date(n.createdAt).getTime() < DAY_MS,
    );
  }
  return active.filter(
    (n) => now - new Date(n.createdAt).getTime() < 7 * DAY_MS,
  );
}

function isSafeHref(href: string): boolean {
  // Allow same-app paths only.
  if (href.startsWith("/portal/") || href.startsWith("/admin/")) return true;
  // Allow absolute leasestack.co URLs (server-generated tenant
  // marketing-site links land here for cross-tenant report shares).
  try {
    const url = new URL(href);
    return url.hostname.endsWith(".leasestack.co") || url.hostname === "leasestack.co";
  } catch {
    return false;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/portal/notifications?limit=50", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d: { notifications: Notification[] }) => setItems(d.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleMarkAll() {
    startTransition(async () => {
      await markAllRead();
      setItems((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
    });
  }

  function handleRowClick(item: Notification) {
    if (!item.readAt) {
      startTransition(async () => {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
          ),
        );
      });
    }
    // Notification hrefs come from server-generated rows so they
    // SHOULD be safe, but validate before navigating: reject anything
    // that doesn't start with `/portal/`, `/admin/`, or our own
    // domain. Prevents a stray malformed href from kicking the user
    // out to an unrelated page or a phishing target if a row was
    // ever crafted by an attacker.
    if (item.href && isSafeHref(item.href)) {
      router.push(item.href);
    } else if (item.href) {
      console.warn("[notifications] refusing to navigate to unsafe href", {
        href: item.href,
        notificationId: item.id,
      });
    }
  }

  function handleSnooze(item: Notification, days: number) {
    startTransition(async () => {
      await snoozeNotification(item.id, days);
      const snoozedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, snoozedUntil, readAt: n.readAt ?? new Date().toISOString() }
            : n,
        ),
      );
    });
  }

  function handleUnsnooze(item: Notification) {
    startTransition(async () => {
      await unsnoozeNotification(item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, snoozedUntil: null } : n)),
      );
    });
  }

  function handleResolve(item: Notification) {
    startTransition(async () => {
      await resolveNotification(item.id);
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, resolvedAt: now, readAt: n.readAt ?? now, snoozedUntil: null }
            : n,
        ),
      );
    });
  }

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
  ];

  const visible = applyFilter(items, filter);
  const now = Date.now();
  const unreadCount = items.filter(
    (n) => !n.readAt && !n.resolvedAt && !isSnoozed(n, now),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              Mark all read
            </button>
          ) : null
        }
      />

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground border-foreground"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-muted/60 mt-2 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-64 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted/60 rounded" />
                </div>
                <div className="h-3 w-14 bg-muted/40 rounded shrink-0" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center flex flex-col items-center gap-1.5">
            <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {items.length === 0
                ? "You're all set."
                : filter === "unread"
                  ? "All caught up."
                  : "Nothing to show here."}
            </p>
            <p className="max-w-sm text-[11px] text-muted-foreground leading-snug">
              {items.length === 0
                ? "Notifications about new leads, scheduled tours, chatbot conversations, and integration health land here."
                : filter === "unread"
                  ? "No unread notifications. Recent activity still appears under “All.”"
                  : "Try a different filter to see more activity."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => {
              const snoozed = isSnoozed(item, now);
              const resolved = Boolean(item.resolvedAt);
              const actionable = ACTIONABLE_KINDS.has(item.kind);
              return (
                <NotificationRow
                  key={item.id}
                  item={item}
                  snoozed={snoozed}
                  resolved={resolved}
                  actionable={actionable}
                  onOpen={() => handleRowClick(item)}
                  onSnooze={(days) => handleSnooze(item, days)}
                  onUnsnooze={() => handleUnsnooze(item)}
                  onResolve={() => handleResolve(item)}
                />
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing the most recent 50 notifications. Older notifications are retained
        in the database.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Row component — keeps the main page readable. The title/body region is a
// button (full-row click navigates to href / marks read), with sibling
// action buttons in their own column so Snooze/Resolve don't also fire the
// row click.
// ----------------------------------------------------------------------------

function NotificationRow(props: {
  item: Notification;
  snoozed: boolean;
  resolved: boolean;
  actionable: boolean;
  onOpen: () => void;
  onSnooze: (days: number) => void;
  onUnsnooze: () => void;
  onResolve: () => void;
}): React.JSX.Element {
  const { item, snoozed, resolved, actionable, onOpen, onSnooze, onUnsnooze, onResolve } = props;

  return (
    <div
      className={cn(
        "px-4 py-2 hover:bg-muted/40 transition-colors flex items-center gap-2",
        KIND_BORDER[item.kind] ?? "",
        !item.readAt && !resolved && "bg-primary/5",
        (snoozed || resolved) && "opacity-60",
      )}
    >
      {!item.readAt && !resolved ? (
        <span className="shrink-0 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      ) : (
        <span className="shrink-0 h-2 w-2" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left flex items-center gap-2"
      >
        <span
          className={cn(
            "shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded",
            KIND_COLOR[item.kind] ?? "bg-muted text-muted-foreground",
          )}
        >
          {item.kind.replace(/_/g, " ")}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium truncate">
          {item.title}
        </span>
        {item.body && (
          <span className="hidden sm:inline min-w-0 max-w-[40%] text-xs text-muted-foreground truncate">
            {item.body}
          </span>
        )}
        {item.href && (
          <span className="hidden md:inline shrink-0 text-[11px] text-primary underline underline-offset-2">
            View
          </span>
        )}
        {resolved && (
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
            <Check className="h-3 w-3" aria-hidden="true" /> Resolved
          </span>
        )}
        {snoozed && !resolved && (
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            until{" "}
            {item.snoozedUntil
              ? new Date(item.snoozedUntil).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : ""}
          </span>
        )}
      </button>

      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </span>

      {/* Action column. Snooze affordance hidden once resolved (no point). */}
      <div className="shrink-0 flex items-center gap-2 ml-2">
        {!resolved && !snoozed && (
          <>
            <button
              type="button"
              onClick={() => onSnooze(1)}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
              title="Hide until tomorrow"
            >
              1d
            </button>
            <button
              type="button"
              onClick={() => onSnooze(7)}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
              title="Hide for a week"
            >
              7d
            </button>
          </>
        )}
        {snoozed && !resolved && (
          <button
            type="button"
            onClick={onUnsnooze}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
          >
            Unsnooze
          </button>
        )}
        {actionable && !resolved && (
          <button
            type="button"
            onClick={onResolve}
            className="text-[11px] font-medium text-primary hover:text-primary/80 hover:underline underline-offset-2 transition-colors"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}
