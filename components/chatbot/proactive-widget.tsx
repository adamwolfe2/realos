"use client";

import { useEffect, useRef, useState } from "react";
import { ChatInterface } from "./chat-interface";

const SESSION_STORAGE_KEY = "leasestack.chatbot.session.v1";
const DISMISSED_STORAGE_KEY = "leasestack.chatbot.dismissed.v1";
const ENGAGEMENT_POLL_MS = 3_000;
const ENGAGEMENT_LAST_KEY = "leasestack.chatbot.engagement.lastSeen.v1";

type EngagementMessage = {
  id: string;
  message: string;
  openWidget: boolean;
  createdAt: string;
};

// Fallback UUID generator for insecure contexts (plain HTTP, non-localhost
// preview environments) where window.crypto.randomUUID is undefined. Without
// this guard the entire tenant layout crashes on first widget mount.
function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ensureSessionId(): string {
  if (typeof window === "undefined") return safeUUID();
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = safeUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return safeUUID();
  }
}

export function ProactiveWidget({
  orgId,
  personaName,
  avatarUrl,
  greeting,
  idleTriggerSeconds,
}: {
  orgId: string;
  personaName: string;
  avatarUrl?: string | null;
  greeting: string;
  idleTriggerSeconds: number;
}) {
  const [open, setOpen] = useState(false);
  const [bubbleShown, setBubbleShown] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [sessionId, setSessionId] = useState<string>("pending");
  const [pendingEngagements, setPendingEngagements] = useState<
    EngagementMessage[]
  >([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    setSessionId(ensureSessionId());
    try {
      if (window.sessionStorage.getItem(DISMISSED_STORAGE_KEY)) {
        setBubbleDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (bubbleShown || bubbleDismissed || open) return;
    timerRef.current = setTimeout(() => {
      setBubbleShown(true);
    }, Math.max(0, idleTriggerSeconds) * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bubbleShown, bubbleDismissed, open, idleTriggerSeconds]);

  // Engagement poll. Hits /api/public/chatbot/inbox every ENGAGEMENT_POLL_MS
  // and surfaces any operator-pushed messages as assistant turns inside the
  // widget. Server-side endpoint atomically marks rows DELIVERED on read so
  // the same message isn't double-rendered.
  useEffect(() => {
    if (sessionId === "pending") return;
    try {
      lastSeenRef.current =
        window.localStorage.getItem(ENGAGEMENT_LAST_KEY) ?? null;
    } catch {
      // ignore
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const url = new URL(
          "/api/public/chatbot/inbox",
          window.location.origin
        );
        url.searchParams.set("sessionId", sessionId);
        if (lastSeenRef.current) {
          url.searchParams.set("since", lastSeenRef.current);
        }
        const res = await fetch(url.toString(), {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const body = (await res.json()) as {
            engagements?: EngagementMessage[];
            serverTime?: string;
          };
          const engagements = body.engagements ?? [];
          if (engagements.length > 0) {
            const shouldOpen = engagements.some((e) => e.openWidget);
            setPendingEngagements((prev) => [...prev, ...engagements]);
            if (shouldOpen) {
              setOpen(true);
              setBubbleShown(false);
            } else {
              setBubbleShown(true);
            }
            // Track the latest delivery so subsequent polls skip handled rows.
            const latest = engagements[engagements.length - 1].createdAt;
            lastSeenRef.current = latest;
            try {
              window.localStorage.setItem(ENGAGEMENT_LAST_KEY, latest);
            } catch {
              // ignore
            }
            // GA4 hook (loaded by the marketing site).
            const dataLayer = (window as unknown as {
              dataLayer?: Array<Record<string, unknown>>;
            }).dataLayer;
            if (Array.isArray(dataLayer)) {
              dataLayer.push({
                event: "chatbot_engagement_delivered",
                count: engagements.length,
              });
            }
          }
          if (body.serverTime && !lastSeenRef.current) {
            lastSeenRef.current = body.serverTime;
          }
        }
      } catch {
        // network blip — keep polling.
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, ENGAGEMENT_POLL_MS);
        }
      }
    }

    timer = setTimeout(tick, ENGAGEMENT_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  function dismissBubble() {
    setBubbleShown(false);
    setBubbleDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  function openChat() {
    setOpen(true);
    setBubbleShown(false);
  }

  return (
    <>
      {bubbleShown && !open ? (
        <div
          role="dialog"
          aria-label="Greeting from the leasing team"
          className="fixed bottom-24 right-4 z-40 max-w-xs bg-white shadow-2xl rounded-xl p-3 border animate-in slide-in-from-bottom-4"
        >
          <div className="flex items-start gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={personaName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: "var(--tenant-primary)" }}
              >
                {personaName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold">{personaName}</div>
              <p className="text-sm opacity-80 mt-0.5">{greeting}</p>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={openChat}
                  className="text-xs font-semibold underline underline-offset-2"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={dismissBubble}
                  className="text-xs opacity-60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full shadow-2xl text-white flex items-center justify-center text-2xl"
        style={{ backgroundColor: "var(--tenant-primary)" }}
      >
        {open ? "×" : "💬"}
      </button>

      {open ? (
        <ChatInterface
          orgId={orgId}
          sessionId={sessionId}
          personaName={personaName}
          avatarUrl={avatarUrl}
          greeting={greeting}
          onClose={() => setOpen(false)}
          injectedMessages={pendingEngagements}
          onInjectedConsumed={(ids) => {
            setPendingEngagements((prev) =>
              prev.filter((m) => !ids.includes(m.id))
            );
          }}
        />
      ) : null}
    </>
  );
}
