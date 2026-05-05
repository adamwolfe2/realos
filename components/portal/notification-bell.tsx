"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllRead, markNotificationRead } from "@/lib/actions/notifications";
import { formatDistanceToNow } from "date-fns";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const KIND_COLOR: Record<string, string> = {
  lead_created: "bg-primary/15 text-primary",
  tour_scheduled: "bg-primary/15 text-primary",
  chatbot_lead: "bg-muted text-muted-foreground",
  integration_error: "bg-destructive/10 text-destructive",
  sync_complete: "bg-foreground/10 text-foreground",
};

function kindLabel(kind: string) {
  return kind.replace(/_/g, " ");
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll unread count every 30 s.
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/notifications/unread-count", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const { count } = (await res.json()) as { count: number };
      setUnread(count);
    } catch {
      // network failure — silently ignore
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Fetch recent items when the panel opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/portal/notifications/recent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((data: { notifications: NotificationRow[] }) =>
        setItems(data.notifications)
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleMarkAll() {
    startTransition(async () => {
      await markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    });
  }

  function handleItemClick(item: NotificationRow) {
    if (!item.readAt) {
      startTransition(async () => {
        await markNotificationRead(item.id);
        setUnread((n) => Math.max(0, n - 1));
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
      });
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors",
                    !item.readAt && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!item.readAt && (
                      <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                    <div className={cn("min-w-0 flex-1", item.readAt && "pl-3.5")}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
                            KIND_COLOR[item.kind] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {kindLabel(item.kind)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{item.title}</p>
                      {item.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.body}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-border">
            <Link
              href="/portal/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
