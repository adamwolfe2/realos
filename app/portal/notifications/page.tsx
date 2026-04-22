"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllRead, markNotificationRead } from "@/lib/actions/notifications";
import { formatDistanceToNow } from "date-fns";

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
  lead_created: "bg-emerald-100 text-emerald-700",
  tour_scheduled: "bg-sky-100 text-sky-700",
  chatbot_lead: "bg-violet-100 text-violet-700",
  integration_error: "bg-rose-100 text-rose-700",
  sync_complete: "bg-foreground/10 text-foreground",
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
    if (item.href) router.push(item.href);
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

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

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            Loading...
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
                  !item.readAt && "bg-primary/5"
                )}
              >
                {!item.readAt && (
                  <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-primary" />
                )}
                <div className={cn("min-w-0 flex-1", item.readAt && "pl-5")}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded",
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
