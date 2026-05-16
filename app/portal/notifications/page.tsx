"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllRead, markNotificationRead } from "@/lib/actions/notifications";
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
};

const KIND_COLOR: Record<string, string> = {
  lead_created: "bg-primary/10 text-primary",
  tour_scheduled: "bg-primary/10 text-primary",
  chatbot_lead: "bg-muted text-muted-foreground",
  integration_error: "bg-destructive/10 text-destructive",
  sync_complete: "bg-muted text-muted-foreground",
};

// Severity-coded left border. Mirrors AlertBanner's palette so rows visually
// rank from the page (red = critical, amber = warning, blue = info). Anything
// not classified gets no border so the feed stays calm.
const KIND_BORDER: Record<string, string> = {
  integration_error: "border-l-2 border-l-destructive",
  lead_created: "border-l-2 border-l-primary",
  tour_scheduled: "border-l-2 border-l-primary",
  chatbot_lead: "border-l-2 border-l-primary",
  sync_complete: "",
};

type Filter = "all" | "unread" | "today" | "week";

function applyFilter(items: Notification[], filter: Filter): Notification[] {
  if (filter === "all") return items;
  if (filter === "unread") return items.filter((n) => !n.readAt);
  const now = Date.now();
  const DAY_MS = 86_400_000;
  if (filter === "today") {
    return items.filter(
      (n) => now - new Date(n.createdAt).getTime() < DAY_MS
    );
  }
  return items.filter(
    (n) => now - new Date(n.createdAt).getTime() < 7 * DAY_MS
  );
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
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      );
    });
  }

  function handleRowClick(item: Notification) {
    if (!item.readAt) {
      startTransition(async () => {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
          )
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

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
  ];

  const visible = applyFilter(items, filter);
  const unreadCount = items.filter((n) => !n.readAt).length;

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
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
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
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            {filter === "unread"
              ? "All caught up. No unread notifications."
              : "No notifications match this filter."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleRowClick(item)}
                className={cn(
                  "w-full text-left px-4 py-4 hover:bg-muted/40 transition-colors flex items-start gap-3",
                  KIND_BORDER[item.kind] ?? "",
                  !item.readAt && "bg-primary/5"
                )}
              >
                {!item.readAt && (
                  <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                )}
                <div className={cn("min-w-0 flex-1", item.readAt && "pl-5")}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "text-xs uppercase tracking-wide px-1.5 py-0.5 rounded",
                        KIND_COLOR[item.kind] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.body && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
                  )}
                  {item.href && (
                    <span className="text-xs text-primary mt-1 inline-block underline underline-offset-2">
                      View details
                    </span>
                  )}
                </div>
              </button>
            ))}
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
