"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "How long does a portal build take?",
    a: "Most portals are fully built and deployed within 10–14 business days from our first call. The intake form and consultation help us move fast — we already know your products, workflow, and feature needs before we start building.",
  },
  {
    q: "What does the demo show?",
    a: "The demo is a live version of the actual portal platform with sample data — not a mockup. When you enter your website, we scrape your logo and brand colors and apply them to the demo so you can see exactly what your clients will experience. You can click through every page: product catalog, client portal, admin panel, order management, invoicing, and more.",
  },
  {
    q: "How much does a portal build cost?",
    a: "Wholesail builds are high-ticket, white-glove engagements. Pricing depends on the features you need, number of product SKUs, integrations, and customization level. We scope everything on the consultation call and provide a clear investment estimate before you commit.",
  },
  {
    q: "Do I own the code?",
    a: "Yes, completely. Your portal is deployed to your own Vercel account, connected to your own database, Stripe account, and domain. You own everything. We also provide full documentation so your team (or any developer) can maintain and extend it.",
  },
  {
    q: "What integrations are included?",
    a: "The core platform includes Stripe (payments & invoicing), Clerk (client authentication), Resend (transactional emails), and Neon (database). Optional add-ons include Bloo.io (text message ordering), Firecrawl (lead enrichment), and Upstash Redis (rate limiting). All integrations are configured during the build — nothing for you to set up.",
  },
  {
    q: "Can my existing wholesale clients use this?",
    a: "Absolutely. The portal includes a client claim flow where existing clients can claim their account by verifying their email or phone number. We also support bulk client import from spreadsheets, and automated invitation emails. Most distributors onboard their first 10–20 clients within the first week.",
  },
  {
    q: "What if I need changes after launch?",
    a: "The portal is built to evolve. After launch, we offer ongoing support packages for adding features, adjusting workflows, and scaling. Since you own the code and it's built on standard Next.js / React, any developer can also make changes independently.",
  },
  {
    q: "How does text message ordering work?",
    a: "Clients send a text with what they need (e.g., '2 cases salmon, 5 lb truffles'). The system matches those items to your product catalog, sends back a confirmation with the order total, and the client replies 'YES' to confirm. The order flows directly into your admin panel — no phone call required.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto" style={{ border: "1px solid var(--border-strong)" }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={i < FAQ_ITEMS.length - 1 ? "border-b" : ""}
            style={{ borderColor: "var(--border-strong)" }}
          >
            <button
              id={`faq-trigger-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${i}`}
              className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors"
              style={{ backgroundColor: isOpen ? "var(--bg-white)" : "transparent" }}
            >
              <span className="font-serif text-base pr-4" style={{ color: "var(--text-headline)" }}>
                {item.q}
              </span>
              <ChevronDown
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                style={{ color: "var(--text-muted)" }}
              />
            </button>
            <div
              id={`faq-answer-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? "max-h-96" : "max-h-0"
              }`}
            >
              <p className="px-6 pb-4 font-mono text-xs leading-relaxed" style={{ color: "var(--text-body)" }}>
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
