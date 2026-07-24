"use client";

import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { SPRING_POP } from "@/components/portal/ui/motion";

// ---------------------------------------------------------------------------
// MessageBubbleList — shared transcript renderer for the conversations
// inbox (inline-transcript.tsx) and the full conversation detail page
// ([id]/page.tsx), which previously each hand-rolled their own near-
// identical MessageBubble. Consolidated here (cohesion fix, 2026-07-24)
// and given the spring-in entrance from the marketing walkthrough's
// ScreenChatbot (initial y/scale pop, staggered per message, reduced-motion
// renders every bubble immediately in place).
// ---------------------------------------------------------------------------

export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

export function MessageBubbleList({ messages }: { messages: TranscriptMessage[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        // Cap the stagger so a long transcript doesn't take seconds to
        // finish popping in.
        const delay = reduce ? 0 : Math.min(i, 12) * 0.05;
        return (
          <motion.div
            key={i}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SPRING_POP, delay }}
          >
            <div
              className={`max-w-[78%] text-sm px-4 py-2.5 rounded-[10px] whitespace-pre-wrap leading-relaxed ${
                isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <div
                className={`text-[10px] uppercase tracking-widest mb-1 ${
                  isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {isUser ? "Visitor" : "Assistant"}
              </div>
              {m.content}
              {m.ts ? (
                <div
                  className={`text-[10px] mt-1 tabular-nums ${
                    isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {format(new Date(m.ts), "MMM d, p")}
                </div>
              ) : null}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
