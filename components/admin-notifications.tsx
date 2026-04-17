"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  ShoppingCart,
  FileText,
  MessageSquare,
  Receipt,
  X,
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  link: string;
  read?: boolean;
}

const TYPE_ICONS: Record<string, typeof ShoppingCart> = {
  new_order: ShoppingCart,
  quote_update: FileText,
  new_message: MessageSquare,
  invoice_created: Receipt,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SEEN_STORAGE_KEY = "admin_notifications_seen_at";

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load seenAt from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SEEN_STORAGE_KEY);
    if (stored) setSeenAt(stored);
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    const params = seenAt ? `?seen=${encodeURIComponent(seenAt)}` : "";
    fetch(`/api/admin/notifications${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch(() => {
        // silent — notifications are non-critical
      });
  }, [seenAt]);

  // SSE connection with auto-reconnect
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      if (closed) return;

      const since = seenAt ?? new Date().toISOString();
      const es = new EventSource(
        `/api/admin/notifications/stream?since=${encodeURIComponent(since)}`
      );
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          setNotifications((prev) => {
            // Deduplicate by id
            if (prev.some((n) => n.id === notification.id)) return prev;
            return [notification, ...prev].slice(0, 50);
          });
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 5 seconds
        if (!closed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimeout);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
    // Only reconnect when seenAt changes are not needed for the stream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const unreadCount = seenAt
    ? notifications.filter((n) => new Date(n.timestamp) > new Date(seenAt))
        .length
    : notifications.length;

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setSeenAt(now);
    localStorage.setItem(SEEN_STORAGE_KEY, now);
    fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seenAt: now }),
    }).catch(() => {
      // silent
    });
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className="relative p-2 text-ink hover:bg-shell rounded-none transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-cream">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 border border-shell bg-cream shadow-lg rounded-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-shell px-4 py-3">
            <h3 className="font-serif font-bold text-sm text-ink">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-sand hover:text-ink transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-sand hover:text-ink transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-sand">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                const isUnread = seenAt
                  ? new Date(n.timestamp) > new Date(seenAt)
                  : true;
                return (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-shell last:border-b-0 hover:bg-cream-hover transition-colors ${
                      isUnread ? "bg-cream-hover/50" : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex-shrink-0 p-1.5 rounded-none ${
                        isUnread
                          ? "bg-ink text-cream"
                          : "bg-shell text-sand"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm truncate ${
                          isUnread
                            ? "font-semibold text-ink"
                            : "text-ink/70"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-sand mt-0.5">
                        {timeAgo(n.timestamp)}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-ink" />
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
