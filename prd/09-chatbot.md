# Sprint 09 — AI Chatbot (Forked from Telegraph Commons)

**Duration:** 1 day
**Dependencies:** Sprint 07
**Goal:** Fork the proactive chatbot already built for Telegraph Commons, make it multi-tenant via `TenantSiteConfig`, log every conversation, convert lead captures into `Lead` records, route hot leads to the agency and client.

---

## Fork from Telegraph Commons

**FORK FROM:** `github.com/adamwolfe2/telegraph-commons` — the chatbot with 5-second idle trigger is already built there. Before writing this sprint, pull that repo and identify:

1. The chatbot widget component (likely `components/chatbot/*.tsx` or `components/ai/*`)
2. The proactive trigger logic (idle timer, exit intent, scroll-based)
3. The conversation UI (message list, input, typing indicator, persona avatar)
4. The API route powering it (likely `app/api/chat/route.ts` using Anthropic SDK)
5. The knowledge base / system prompt shape

Port these into the new monorepo as follows:

| Telegraph Commons | New location |
|---|---|
| Chatbot widget | `components/chatbot/proactive-widget.tsx` |
| Chat UI | `components/chatbot/chat-interface.tsx` |
| API route | `app/api/chatbot/route.ts` |
| System prompt / KB | `lib/chatbot/build-system-prompt.ts` |
| Trigger logic | `components/chatbot/proactive-trigger.tsx` or inside widget |

The Telegraph Commons version is hardcoded to Norman's property. Our version reads all per-tenant config (persona name, greeting, knowledge base, idle trigger delay, brand colors) from `TenantSiteConfig`.

---

## Step-by-step

### 1. Chatbot loader

```tsx
// components/chatbot/chatbot-loader.tsx
import { ProactiveWidget } from "./proactive-widget";
import type { TenantSiteConfig } from "@prisma/client";

export function ChatbotLoader({ orgId, config }: { orgId: string; config: TenantSiteConfig | null }) {
  if (!config?.enableChatbot) return null;
  return (
    <ProactiveWidget
      orgId={orgId}
      personaName={config.chatbotPersonaName ?? "Assistant"}
      avatarUrl={config.chatbotAvatarUrl}
      greeting={config.chatbotGreeting ?? "Hey — how can I help?"}
      idleTriggerSeconds={config.chatbotIdleTriggerSeconds ?? 5}
    />
  );
}
```

### 2. Proactive widget (fork from Telegraph Commons)

```tsx
// components/chatbot/proactive-widget.tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { ChatInterface } from "./chat-interface";

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
  const [sessionId] = useState(() => crypto.randomUUID());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (bubbleShown) return;
    timerRef.current = setTimeout(() => {
      setBubbleShown(true);
    }, idleTriggerSeconds * 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [bubbleShown, idleTriggerSeconds]);

  return (
    <>
      {/* Proactive bubble that auto-opens after idle */}
      {bubbleShown && !open && (
        <div
          className="fixed bottom-20 right-6 max-w-xs bg-white shadow-xl rounded-lg p-4 cursor-pointer animate-in slide-in-from-bottom"
          onClick={() => setOpen(true)}
        >
          <div className="flex items-start gap-3">
            {avatarUrl && <img src={avatarUrl} alt={personaName} className="w-10 h-10 rounded-full" />}
            <div>
              <div className="font-semibold text-sm">{personaName}</div>
              <div className="text-sm text-gray-600">{greeting}</div>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--brand-primary)] text-white shadow-xl flex items-center justify-center text-2xl"
        onClick={() => setOpen(o => !o)}
        aria-label="Open chat"
      >
        {open ? "×" : "💬"}
      </button>

      {/* Chat panel */}
      {open && (
        <ChatInterface
          orgId={orgId}
          sessionId={sessionId}
          personaName={personaName}
          avatarUrl={avatarUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

### 3. Chat interface

```tsx
// components/chatbot/chat-interface.tsx
"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function ChatInterface({
  orgId, sessionId, personaName, avatarUrl, onClose,
}: {
  orgId: string;
  sessionId: string;
  personaName: string;
  avatarUrl?: string | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user" as const, content: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    const res = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        sessionId,
        messages: next,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
    const data = await res.json();
    setMessages([...next, { role: "assistant", content: data.reply }]);
    setSending(false);
  }

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-lg shadow-xl flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b">
        {avatarUrl && <img src={avatarUrl} alt={personaName} className="w-10 h-10 rounded-full" />}
        <div className="flex-1">
          <div className="font-semibold">{personaName}</div>
          <div className="text-xs text-green-600">● Online</div>
        </div>
        <button onClick={onClose} aria-label="Close">×</button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              m.role === "user"
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-gray-100 text-black"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && <div className="text-gray-400 text-sm">...</div>}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 border rounded px-3 py-2"
        />
        <button onClick={send} disabled={sending} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded">Send</button>
      </div>
    </div>
  );
}
```

### 4. Chatbot API route

```typescript
// app/api/chatbot/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/chatbot/build-system-prompt";
import { extractLeadCapture } from "@/lib/chatbot/extract-lead";
import { ratelimit } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await ratelimit.limit(ip);
  if (!success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const body = await req.json();
  const { orgId, sessionId, messages, pageUrl } = body;

  // Load tenant + property + available listings for context
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      tenantSiteConfig: true,
      properties: {
        include: {
          listings: { where: { isAvailable: true } },
        },
      },
    },
  });
  if (!org) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const systemPrompt = buildSystemPrompt(org);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
  });

  const reply = response.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");

  // Upsert conversation
  const full = [...messages, { role: "assistant", content: reply }];
  const extracted = extractLeadCapture(full);

  const convo = await prisma.chatbotConversation.upsert({
    where: { sessionId },
    create: {
      orgId,
      sessionId,
      messages: full,
      messageCount: full.length,
      status: extracted.email ? "LEAD_CAPTURED" : "ACTIVE",
      capturedName: extracted.name,
      capturedEmail: extracted.email,
      capturedPhone: extracted.phone,
      pageUrl,
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress: ip,
    },
    update: {
      messages: full,
      messageCount: full.length,
      lastMessageAt: new Date(),
      status: extracted.email ? "LEAD_CAPTURED" : "ACTIVE",
      capturedName: extracted.name ?? undefined,
      capturedEmail: extracted.email ?? undefined,
      capturedPhone: extracted.phone ?? undefined,
    },
  });

  // Create Lead on first email capture
  if (extracted.email && convo.status === "LEAD_CAPTURED" && !convo.leadId) {
    const lead = await prisma.lead.create({
      data: {
        orgId,
        propertyId: org.properties[0]?.id,
        source: "CHATBOT",
        firstName: extracted.name?.split(" ")[0],
        lastName: extracted.name?.split(" ").slice(1).join(" "),
        email: extracted.email,
        phone: extracted.phone,
        notes: `From chatbot. Page: ${pageUrl}`,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: convo.id },
      data: { leadId: lead.id },
    });
  }

  return NextResponse.json({ reply });
}
```

### 5. System prompt builder

```typescript
// lib/chatbot/build-system-prompt.ts
export function buildSystemPrompt(org: any): string {
  const config = org.tenantSiteConfig;
  const property = org.properties[0];
  const listings = property?.listings ?? [];

  const availableUnitsSummary = listings.length === 0
    ? "All units currently leased. Waitlist available."
    : listings.map((l: any) =>
        `- ${l.unitType ?? "Unit"} ${l.unitNumber ?? ""}: $${l.priceCents ? l.priceCents / 100 : "?"} /mo, ${l.bedrooms ?? "?"} bed / ${l.bathrooms ?? "?"} bath`
      ).join("\n");

  return `You are ${config?.chatbotPersonaName ?? "an assistant"} for ${org.name}.

${config?.chatbotKnowledgeBase ?? ""}

PROPERTY FACTS:
- Property: ${property?.name ?? org.name}
- Address: ${property?.addressLine1 ?? ""}, ${property?.city ?? ""}, ${property?.state ?? ""}
- Type: ${org.residentialSubtype ?? org.propertyType}
- Available units:
${availableUnitsSummary}

YOUR JOB:
- Answer questions about the property, units, location, amenities, pricing, move-in dates, application process.
- Be warm, direct, and concise. Never more than 3 short paragraphs per reply.
- If the visitor shows interest (asks about touring, pricing specifics, availability for a specific date), ask for their name and email so the leasing team can follow up.
- If asked something you don't know, say so and offer to connect them to the team.
- Do NOT make up pricing, unit availability, or policies.
- If the visitor seems ready to apply, point them to /apply.

If the visitor shares their name, email, or phone, acknowledge briefly and continue the conversation naturally — do not stop mid-flow.`;
}
```

### 6. Lead capture extractor

```typescript
// lib/chatbot/extract-lead.ts
export function extractLeadCapture(messages: any[]): { name?: string; email?: string; phone?: string } {
  const userMessages = messages.filter(m => m.role === "user").map(m => m.content).join(" ");

  const emailMatch = userMessages.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = userMessages.match(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

  // Name extraction: simple heuristic, e.g. "my name is X" or "I'm X"
  const nameMatch = userMessages.match(/(?:my name is|i'?m|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

  return {
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    name: nameMatch?.[1],
  };
}
```

### 7. Portal conversations view

`app/portal/conversations/page.tsx`:

```tsx
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function ConversationsList() {
  const scope = await requireClient();
  const convos = await prisma.chatbotConversation.findMany({
    where: { orgId: scope.orgId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Chatbot conversations</h1>
      <div className="space-y-2">
        {convos.map(c => (
          <Link key={c.id} href={`/portal/conversations/${c.id}`} className="block p-4 border rounded-lg hover:bg-gray-50">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{c.capturedName ?? "Anonymous"}</div>
                {c.capturedEmail && <div className="text-sm">{c.capturedEmail}</div>}
                <div className="text-xs text-muted-foreground">{c.messageCount} messages · {c.status}</div>
              </div>
              <div className="text-sm text-muted-foreground">{formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Detail page `app/portal/conversations/[id]/page.tsx` — renders full message history + captured lead link + handoff button.

### 8. Handoff flow

"Handoff to team" button on conversation detail updates `status: HANDED_OFF`, emails the tenant's configured inbox, and creates a ClientNote.

### 9. Rate limit + abuse protection

- Per-IP rate limit on `/api/chatbot` (10 requests / minute)
- Per-session message cap (50 messages per sessionId before throttling)
- Content filter: reject messages containing clear attack patterns (prompt injection, credit card requests, etc.) — use Anthropic's built-in safety but log blocked conversations

### 10. Testing

Manual test on Telegraph Commons staging:
- Load `telegraph-commons.{platformdomain}.com`, wait 5 seconds → bubble appears
- Click bubble → chat opens with greeting
- Ask "what units are available?" → answer should pull from live listings
- Share email "my email is test@example.com" → conversation marked LEAD_CAPTURED, Lead row created
- Check `/portal/conversations` shows the conversation
- Check `/portal/leads` shows the new lead with `source: CHATBOT`

---

## Done when

- [ ] Chatbot forked successfully from Telegraph Commons into new monorepo
- [ ] All config driven by `TenantSiteConfig`
- [ ] Every tenant with `enableChatbot: true` gets a working chatbot
- [ ] Conversations persist across messages (sessionId upsert)
- [ ] Lead captured on first email mention, linked back to conversation
- [ ] Portal conversations + leads views render correctly
- [ ] Rate limiting in place
- [ ] Telegraph Commons passes smoke test

## Handoff to Sprint 10
Chatbot + pixel + forms are all feeding `Lead` records. Sprint 10 builds the CRM muscle on top: follow-up automation, drip sequences, nurture cadences, and a lapsed-lead recovery cron.
