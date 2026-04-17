"use client";

import {
  ShoppingCart,
  ArrowRight,
  ChevronDown,
  Shield,
  Snowflake,
} from "lucide-react";
import type { ViewProps } from "./types";
import { ProductImage } from "./utils";

export function MarketingView({ brand, data, onNavigate }: ViewProps) {
  const headline = data.heroHeadline || data.tagline || `Premium ${data.industry || "Wholesale"} Products, Always Fresh.`;
  const featuredProducts = data.products.filter((p) => p.featured).slice(0, 4);
  const displayProducts = featuredProducts.length >= 4 ? featuredProducts : data.products.slice(0, 4);
  const trustItems = data.valuePropositions.length > 0
    ? data.valuePropositions
    : ["Same-Week Delivery", "Premium Quality", "Net-30 Terms", "Cold Chain Certified", "Dedicated Support"];

  return (
    <div className="space-y-0">
      {/* -- Hero -- */}
      <section className="px-4 sm:px-6 lg:px-10 py-12 sm:py-20 bg-cream border-b border-shell">
        <div className="max-w-3xl">
          <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-sand mb-5">
            Wholesale · Est. {data.location || "United States"}
          </p>
          <h1
            className="font-serif font-bold leading-[1.02] tracking-tight text-ink mb-6"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}
          >
            {headline}
          </h1>
          <p className="text-sm sm:text-base text-ink/50 max-w-lg leading-relaxed mb-8">
            {data.companyDescription || `${brand.company} — your trusted wholesale partner. Browse our catalog, place orders online, and track deliveries in real time.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate?.("catalog")}
              className="h-12 px-8 text-sm font-medium tracking-wide text-cream transition-opacity hover:opacity-85"
              style={{ backgroundColor: brand.color }}
            >
              Browse the Catalog
            </button>
            <button
              className="h-12 px-8 text-sm font-medium tracking-wide border transition-colors"
              style={{ borderColor: brand.color, color: brand.color }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = brand.color; e.currentTarget.style.color = "var(--color-cream)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = brand.color; }}
            >
              Apply for Wholesale
            </button>
          </div>
          <div className="mt-10 opacity-40">
            <ChevronDown className="h-5 w-5 text-ink animate-bounce" />
          </div>
        </div>
      </section>

      {/* -- Trust Bar / Scrolling Marquee -- */}
      <div className="text-cream py-3 overflow-hidden select-none" style={{ backgroundColor: brand.color }}>
        <div className="flex whitespace-nowrap" style={{ animation: "ticker 22s linear infinite" }}>
          {[...trustItems, ...trustItems, ...trustItems].map((item, i) => (
            <span key={i} className="mx-6 sm:mx-10 text-[10px] sm:text-xs tracking-[0.18em] uppercase font-medium">
              {item}
              <span className="mx-5 sm:mx-8 opacity-25">&middot;</span>
            </span>
          ))}
        </div>
      </div>

      {/* -- This Week's Highlights (gap-px grid) -- */}
      <section className="py-10 sm:py-16 border-b border-shell bg-cream/50">
        <div className="px-4 sm:px-6 lg:px-10 mb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-sand mb-3">Curated Selection</p>
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-ink">This Week&apos;s Highlights</h2>
            <button
              onClick={() => onNavigate?.("catalog")}
              className="hidden sm:flex items-center gap-1 text-xs tracking-wide text-ink/40 hover:text-ink transition-colors"
            >
              View Full Catalog <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="mx-4 sm:mx-6 lg:mx-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-shell">
          {displayProducts.map((p, i) => (
            <div key={`${p.name}-${i}`} className="bg-cream flex flex-col group hover:bg-cream-hover transition-colors">
              <ProductImage product={p} brandColor={brand.color} size="lg" />
              <div className="p-4 sm:p-5 flex flex-col flex-1">
                <p className="text-[9px] tracking-[0.18em] uppercase text-sand mb-1.5">{p.category}</p>
                <h3 className="font-serif font-bold leading-tight text-sm sm:text-base text-ink mb-2">{p.name}</h3>
                <p className="text-xs text-ink/50 leading-relaxed line-clamp-2 mb-3">{p.description}</p>
                <p className="text-base font-bold text-ink mt-auto">
                  {p.price}<span className="text-xs font-normal text-sand">{p.unit ? `/${p.unit}` : ""}</span>
                </p>
                {data.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] tracking-wide uppercase border border-shell px-1.5 py-0.5 text-sand inline-flex items-center gap-0.5">
                      <Snowflake className="h-2 w-2" /> Cold Chain
                    </span>
                  </div>
                )}
              </div>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 mt-auto">
                <button
                  onClick={() => onNavigate?.("catalog")}
                  className="w-full h-9 text-xs font-medium border flex items-center justify-center gap-1.5 transition-all"
                  style={{ borderColor: brand.color, color: brand.color }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = brand.color; e.currentTarget.style.color = "var(--color-cream)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = brand.color; }}
                >
                  <ShoppingCart className="h-3 w-3" /> Add to Order
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -- How It Works -- */}
      <section className="border-b border-shell">
        <div className="px-4 sm:px-6 lg:px-10 pt-10 sm:pt-16 mb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-sand mb-3">Simple Process</p>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-ink">How It Works</h2>
        </div>
        <div className="mx-4 sm:mx-6 lg:mx-10 mb-10 sm:mb-16 grid grid-cols-1 sm:grid-cols-3 gap-px bg-shell">
          {[
            { step: "01", title: "Apply", desc: `Submit a quick wholesale application. We review and approve qualified ${data.industry?.toLowerCase() || "business"} partners within 24 hours.` },
            { step: "02", title: "Order", desc: "Browse the full catalog, build your order online or text it via SMS. We handle the rest — same-week fulfillment." },
            { step: "03", title: "Grow", desc: "Track orders, manage invoices, earn loyalty rewards, and unlock volume pricing as your account grows." },
          ].map((s) => (
            <div key={s.step} className="bg-cream p-8 sm:p-10">
              <p className="font-mono text-4xl sm:text-5xl font-bold text-shell mb-6 leading-none">{s.step}</p>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink mb-3">{s.title}</h3>
              <p className="text-sm text-ink/50 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -- Testimonials -- */}
      {data.testimonials.length > 0 && (
        <section className="py-10 sm:py-16 border-b border-shell">
          <div className="px-4 sm:px-6 lg:px-10 mb-8">
            <p className="text-xs tracking-[0.2em] uppercase text-sand mb-3">Trusted By</p>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-ink">What Our Partners Say</h2>
          </div>
          <div className="mx-4 sm:mx-6 lg:mx-10 grid grid-cols-1 sm:grid-cols-3 gap-px bg-shell">
            {data.testimonials.slice(0, 3).map((t, i) => (
              <div key={i} className="bg-cream p-8 sm:p-10 flex flex-col justify-between min-h-[200px]">
                <div>
                  <p className="font-serif text-5xl text-shell leading-none mb-4 select-none">&ldquo;</p>
                  <p className="text-[15px] leading-relaxed text-ink/80 italic font-serif">{t.quote}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-shell">
                  <p className="font-medium text-sm text-ink">{t.author}</p>
                  {t.company && <p className="text-sand text-xs mt-0.5">{t.company}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* -- Newsletter / CTA Section -- */}
      <section className="border-b border-shell bg-cream overflow-hidden">
        <div className="px-4 sm:px-6 lg:px-10 py-16 sm:py-24 max-w-lg">
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand mb-5">Stay Connected</p>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold italic text-ink leading-none mb-4">
            Get the Latest.
          </h2>
          <p className="text-sm text-ink/50 leading-relaxed mb-6">
            New products, seasonal drops, and exclusive wholesale pricing — delivered to your inbox weekly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 h-12 px-4 bg-white border border-shell text-ink placeholder:text-sand text-sm focus:outline-none focus:border-ink"
            />
            <button className="h-12 px-6 text-cream text-sm font-medium transition-opacity hover:opacity-85" style={{ backgroundColor: brand.color }}>
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* -- Stats Bar -- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-shell bg-cream">
        {[
          { stat: `${Math.max(data.products.length, 20)}+`, label: "Products" },
          { stat: "500+", label: "Partners Served" },
          { stat: data.deliveryInfo || "Same Week", label: "Delivery" },
          { stat: data.paymentInfo || "Net 30", label: "Payment Terms" },
        ].map((s) => (
          <div key={s.label} className="p-6 sm:p-8 text-center border-r border-shell last:border-r-0">
            <div className="text-2xl sm:text-3xl font-serif font-bold text-ink mb-1">{s.stat}</div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      {/* -- Certifications -- */}
      {data.certifications.length > 0 && (
        <div className="px-4 sm:px-6 lg:px-10 py-6 border-b border-shell bg-cream">
          <div className="flex flex-wrap gap-2">
            {data.certifications.map((cert, i) => (
              <span key={i} className="border border-shell px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-sand flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* -- Footer -- */}
      <footer className="bg-ink-dark text-cream px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2">
            <p className="font-serif text-xl font-bold mb-2">{brand.company}</p>
            <p className="text-cream/40 text-sm leading-relaxed max-w-xs">
              {data.tagline || `Premium ${data.industry?.toLowerCase() || "wholesale"} products, delivered with care.`}
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-cream/30 mb-3 font-medium">Catalog</p>
            <ul className="space-y-2 text-sm text-cream/50">
              {Array.from(new Set(data.products.map((p) => p.category).filter(Boolean))).slice(0, 4).map((cat) => (
                <li key={cat} className="hover:text-cream cursor-pointer transition-colors">{cat}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-cream/30 mb-3 font-medium">Company</p>
            <ul className="space-y-2 text-sm text-cream/50">
              <li className="hover:text-cream cursor-pointer transition-colors">About</li>
              <li className="hover:text-cream cursor-pointer transition-colors">Wholesale</li>
              <li className="hover:text-cream cursor-pointer transition-colors">Contact</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-cream/10 pt-6 flex justify-between items-center">
          <p className="text-cream/30 text-xs">&copy; {new Date().getFullYear()} {brand.company}. All rights reserved.</p>
          <p className="text-cream/20 text-[10px] font-mono">Powered by Wholesail</p>
        </div>
      </footer>
    </div>
  );
}
