"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import type { ViewProps } from "./types";
import { parsePrice } from "./utils";

export function SmsDemoView({ brand, data }: ViewProps) {
  const p1 = data.products[0];
  const p2 = data.products.length > 1 ? data.products[1] : data.products[0];
  const p1Price = parsePrice(p1?.price || "$49.99");
  const p2Price = parsePrice(p2?.price || "$79.99");
  const p1Qty = 2;
  const p2Qty = 5;
  const p1Total = p1Price * p1Qty;
  const p2Total = p2Price * p2Qty;
  const subtotal = p1Total + p2Total;
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const initialMessage = `Hey, I need ${p1Qty} ${p1?.unit || "units"} of the ${p1?.name || "Product A"} and ${p2Qty} ${p2?.unit || "units"} of ${p2?.name || "Product B"}`;
  const systemResponse = `Got it! Here's what I parsed from your order:\n\n${p1Qty}x ${p1?.name || "Product A"} (${p1?.price || "$49.99"}/${p1?.unit || "unit"}) — ${formatCurrency(p1Total)}\n${p2Qty}x ${p2?.name || "Product B"} (${p2?.price || "$79.99"}/${p2?.unit || "unit"}) — ${formatCurrency(p2Total)}\n\nSubtotal: ${formatCurrency(subtotal)}\nTax (8.75%): ${formatCurrency(tax)}\nTotal: ${formatCurrency(total)}\n\nReply YES to confirm or EDIT to change.`;
  const confirmResponse = `Order confirmed! ORD-2026-0848 has been placed.\n\nEstimated delivery: Tomorrow by 2 PM.\nTrack your order at ${brand.domain}/track/0848\n\n— ${data.companyName}`;

  const [messages, setMessages] = useState([
    { from: "client", text: initialMessage, time: "10:32 AM" },
  ]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step > 0) return;
    const t1 = setTimeout(() => {
      setMessages((prev) => [...prev, { from: "system", text: systemResponse, time: "10:32 AM" }]);
      setStep(1);
    }, 1500);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== 1) return;
    const t2 = setTimeout(() => {
      setMessages((prev) => [...prev, { from: "client", text: "YES", time: "10:33 AM" }]);
      setStep(2);
    }, 2500);
    return () => clearTimeout(t2);
  }, [step]);

  useEffect(() => {
    if (step !== 2) return;
    const t3 = setTimeout(() => {
      setMessages((prev) => [...prev, { from: "system", text: confirmResponse, time: "10:33 AM" }]);
      setStep(3);
    }, 1500);
    return () => clearTimeout(t3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">AI-Powered</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">SMS / iMessage Ordering</h2>
        <p className="font-sans text-xs text-sand mt-1">Clients text their orders in natural language. AI parses, confirms, and fulfills.</p>
      </div>

      <div className="border border-shell bg-cream max-w-lg mx-auto">
        {/* Phone header */}
        <div className="px-4 py-3 border-b border-shell flex items-center gap-3" style={{ backgroundColor: brand.color }}>
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="font-mono text-xs text-white font-semibold">{data.companyName} SMS</span>
          <span className="ml-auto font-mono text-[9px] text-white/50">AI-Powered</span>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-3 min-h-[400px] bg-white/50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-3 py-2 ${msg.from === "client" ? "text-white" : "bg-white border border-shell"}`}
                style={msg.from === "client" ? { backgroundColor: brand.color } : {}}
              >
                <div className="font-mono text-[11px] whitespace-pre-line leading-relaxed">{msg.text}</div>
                <div className={`font-mono text-[8px] mt-1 ${msg.from === "client" ? "text-white/50" : "text-sand"}`}>{msg.time}</div>
              </div>
            </div>
          ))}
          {(step === 0 || step === 1) && (
            <div className="flex justify-start">
              <div className="flex gap-1 px-3 py-2">
                {[0, 1, 2].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 bg-sand animate-pulse" style={{ animationDelay: `${d * 200}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {step >= 3 && (
          <div className="px-4 py-3 border-t border-shell" style={{ backgroundColor: `${brand.color}10` }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: brand.color }} />
              <span className="font-mono text-xs font-semibold" style={{ color: brand.color }}>Order ORD-2026-0848 created in admin panel</span>
            </div>
          </div>
        )}
      </div>

      {/* Feature callouts */}
      <div className="max-w-lg mx-auto mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Natural Language", desc: "No menus needed" },
          { label: "AI Parsing", desc: "Products + quantities" },
          { label: "Instant Confirm", desc: "Auto-creates order" },
        ].map((f) => (
          <div key={f.label} className="border border-shell bg-cream p-3 text-center">
            <div className="font-mono text-[10px] font-semibold text-ink uppercase">{f.label}</div>
            <div className="font-mono text-[9px] text-sand">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
