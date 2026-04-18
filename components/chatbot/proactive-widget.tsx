"use client";

import { useEffect, useRef, useState } from "react";
import { ChatInterface } from "./chat-interface";

const SESSION_STORAGE_KEY = "realestaite.chatbot.session.v1";
const DISMISSED_STORAGE_KEY = "realestaite.chatbot.dismissed.v1";

function ensureSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        />
      ) : null}
    </>
  );
}
