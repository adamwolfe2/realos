"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import {
  ShoppingCart,
  Bell,
  ArrowUpRight,
  Menu,
  PanelLeftClose,
  X,
} from "lucide-react";
import type { View, ViewProps, CartItem, ScrapeData } from "./types";
import { NAV_ITEMS, TOUR_STEPS } from "./constants";
import { useDemoData, generateSeedData, PlaceholderView } from "./utils";
import { MarketingView } from "./demo-marketing";
import { CatalogView } from "./demo-catalog";
import { AboutView } from "./demo-about";
import { CartSidebar, CheckoutView } from "./demo-checkout";
import { ClientDashboardView } from "./demo-client-dashboard";
import { ClientOrdersView } from "./demo-client-orders";
import { ClientInvoicesView } from "./demo-client-invoices";
import { ClientAnalyticsView } from "./demo-client-analytics";
import { ClientReferralsView } from "./demo-client-referrals";
import { ClientSettingsView } from "./demo-client-settings";
import { AdminDashboardView } from "./demo-admin-dashboard";
import { AdminOrdersView } from "./demo-admin-orders";
import { AdminClientsView } from "./demo-admin-clients";
import { AdminInvoicesView } from "./demo-admin-invoices";
import { AdminProductsView } from "./demo-admin-products";
import { AdminAnalyticsView } from "./demo-admin-analytics";
import { AdminPricingView } from "./demo-admin-pricing";
import { AdminLeadsView } from "./demo-admin-leads";
import { ClientStandingOrdersView } from "./demo-client-standing-orders";
import { FulfillmentBoardView } from "./demo-fulfillment";
import { SmsDemoView } from "./demo-sms";
import { TourOverlay } from "./demo-tour";

// ── Main Demo Portal Inner ───────────────────────────────────────────────

function DemoPortalInner() {
  const { brand, data } = useDemoData();
  const seed = generateSeedData(data);
  const [view, setView] = useState<View>("admin-dashboard");
  // Sidebar: "expanded" = full 240px, "collapsed" = icons only ~52px, "hidden" = 0px
  const [sidebarMode, setSidebarMode] = useState<"expanded" | "collapsed" | "hidden">("expanded");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourDismissed, setTourDismissed] = useState(false);

  // Lead capture state
  const [leadCaptureVisible, setLeadCaptureVisible] = useState(false);
  const [leadCaptureDismissed, setLeadCaptureDismissed] = useState(false);
  const [leadCaptureEmail, setLeadCaptureEmail] = useState("");
  const [leadCaptureSubmitted, setLeadCaptureSubmitted] = useState(false);
  const [leadCaptureSubmitting, setLeadCaptureSubmitting] = useState(false);
  const navClickCount = useRef(0);
  const demoStartTime = useRef(0);

  // Check sessionStorage for prior dismissal on mount
  useEffect(() => {
    try {
      if (sessionStorage.getItem("demo_lead_dismissed") === "1") {
        setLeadCaptureDismissed(true);
        return;
      }
    } catch { /* SSR or quota */ }
    demoStartTime.current = Date.now();
  }, []);

  // Show lead capture after 60s of demo exploration
  useEffect(() => {
    if (leadCaptureDismissed || leadCaptureVisible || leadCaptureSubmitted) return;
    const timer = setTimeout(() => {
      if (Date.now() - demoStartTime.current >= 60_000) {
        setLeadCaptureVisible(true);
      }
    }, 60_000);
    return () => clearTimeout(timer);
  }, [leadCaptureDismissed, leadCaptureVisible, leadCaptureSubmitted]);

  const handleNavClick = useCallback((targetView: View) => {
    setView(targetView);
    navClickCount.current += 1;
    if (navClickCount.current >= 3 && !leadCaptureDismissed && !leadCaptureVisible && !leadCaptureSubmitted) {
      setLeadCaptureVisible(true);
    }
  }, [leadCaptureDismissed, leadCaptureVisible, leadCaptureSubmitted]);

  const dismissLeadCapture = useCallback(() => {
    setLeadCaptureVisible(false);
    setLeadCaptureDismissed(true);
    try { sessionStorage.setItem("demo_lead_dismissed", "1"); } catch { /* ignore */ }
  }, []);

  const submitLeadCapture = useCallback(async () => {
    const email = leadCaptureEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setLeadCaptureSubmitting(true);
    try {
      await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactEmail: email, source: "demo_lead_capture" }),
      });
    } catch { /* best-effort — store locally as fallback */ }
    try { localStorage.setItem("demo_lead_email", email); } catch { /* ignore */ }
    setLeadCaptureSubmitted(true);
    setLeadCaptureVisible(false);
    setLeadCaptureSubmitting(false);
    try { sessionStorage.setItem("demo_lead_dismissed", "1"); } catch { /* ignore */ }
  }, [leadCaptureEmail]);

  // Collapse sidebar on mobile by default
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches) setSidebarMode("collapsed");
    const handler = (e: MediaQueryListEvent) => setSidebarMode(e.matches ? "collapsed" : "expanded");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const sidebarCollapsed = sidebarMode === "collapsed";

  const toggleSidebar = () => {
    setSidebarMode((prev) => {
      if (prev === "expanded") return "collapsed";
      if (prev === "collapsed") return "expanded";
      return "expanded";
    });
  };

  // Show tour prompt after a short delay
  useEffect(() => {
    if (tourDismissed) return;
    const timer = setTimeout(() => setTourStep(0), 1500);
    return () => clearTimeout(timer);
  }, [tourDismissed]);

  // Navigate to tour view when step changes
  useEffect(() => {
    if (tourStep !== null && tourStep < TOUR_STEPS.length) {
      setView(TOUR_STEPS[tourStep].view);
    }
  }, [tourStep]);

  const addToCart = (product: ScrapeData["products"][0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.name === product.name);
      if (existing) return prev.map((c) => c.product.name === product.name ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1 }];
    });
  };
  const removeFromCart = (name: string) => setCart((prev) => prev.filter((c) => c.product.name !== name));
  const updateQuantity = (name: string, qty: number) => setCart((prev) => prev.map((c) => c.product.name === name ? { ...c, quantity: qty } : c));
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const groups = [...new Set(NAV_ITEMS.map((n) => n.group))];
  const viewProps: ViewProps = {
    brand, data, seed, cart,
    onAddToCart: addToCart,
    onRemoveFromCart: removeFromCart,
    onUpdateQuantity: updateQuantity,
    onOpenCart: () => setCartOpen(true),
    onNavigate: setView,
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Demo banner */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3" style={{ backgroundColor: "var(--color-ink)", borderBottom: "1px solid var(--color-ink)" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {brand.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo}
              alt={`${brand.company} logo`}
              className="w-4 h-4 sm:w-5 sm:h-5 object-contain bg-white/20 p-0.5 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-white/70 truncate block">
              Demo preview of <strong className="text-white">{brand.company}</strong>
              <span className="hidden sm:inline">&apos;s wholesale portal</span>
            </span>
            <span className="text-[9px] sm:text-[10px] text-white/40 font-mono hidden sm:block">
              Includes everything you see here + custom branding
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <a
            href="https://cal.com/wholesail/intro"
            className="text-[9px] sm:text-[10px] uppercase tracking-wide text-white/50 hover:text-white font-mono transition-colors flex items-center gap-1"
          >
            Book a Call
          </a>
          <a
            href="/#intake-form"
            className="inline-flex items-center gap-1.5 bg-cream text-ink font-mono text-[10px] sm:text-xs font-semibold uppercase tracking-wide px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-white transition-colors flex-shrink-0"
            style={{ animation: "demoBannerPulse 3s ease-in-out infinite" }}
          >
            <span className="hidden sm:inline">Ready to launch? Start your build</span>
            <span className="sm:hidden">Start Build</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>
      <style>{`
        @keyframes demoBannerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; box-shadow: 0 0 0 2px rgba(249,247,244,0.3); }
        }
      `}</style>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar -- collapsible: expanded (240px), collapsed (52px icons only), hidden (0px) */}
        <aside
          className="flex-shrink-0 border-r border-shell bg-cream overflow-y-auto overflow-x-hidden transition-all duration-200"
          style={{ width: sidebarMode === "expanded" ? 240 : sidebarMode === "collapsed" ? 52 : 0 }}
        >
          {/* Header */}
          <div
            className="border-b border-shell flex items-center flex-shrink-0"
            style={{ height: 56, minWidth: sidebarCollapsed ? 52 : 240, padding: sidebarCollapsed ? "0 10px" : "0 16px", gap: sidebarCollapsed ? 0 : 12 }}
          >
            {sidebarCollapsed ? (
              <button onClick={toggleSidebar} className="w-8 h-8 flex items-center justify-center mx-auto" aria-label="Toggle sidebar">
                <Menu className="w-4 h-4 text-ink/60" />
              </button>
            ) : (
              <>
                {brand.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logo}
                    alt={`${brand.company} logo`}
                    className="w-7 h-7 object-contain flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-serif font-bold text-[15px] text-ink leading-tight block truncate">{brand.company}</span>
                  <span className="font-serif italic text-xs text-sand leading-tight">Wholesale</span>
                </div>
                <button onClick={toggleSidebar} className="flex-shrink-0 p-1 text-sand hover:text-ink" aria-label="Collapse sidebar">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          {/* Nav */}
          <nav aria-label="Demo portal navigation" className="py-3" style={{ minWidth: sidebarCollapsed ? 52 : 240, padding: sidebarCollapsed ? "12px 6px" : "12px 8px" }}>
            {groups.map((group) => (
              <div key={group} className="mb-3">
                {!sidebarCollapsed && (
                  <div className="text-[8px] tracking-[0.25em] uppercase text-sand font-mono px-3 mb-1.5">{group}</div>
                )}
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter((n) => n.group === group).map((item) => {
                    const Icon = item.icon;
                    const active = view === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center text-sm font-medium transition-colors relative ${sidebarCollapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"}`}
                        style={
                          active
                            ? { backgroundColor: brand.color, color: "var(--color-cream)" }
                            : { color: "rgba(10,10,10,0.6)" }
                        }
                        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = `${brand.color}0A`; e.currentTarget.style.color = "var(--color-ink)"; } }}
                        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "rgba(10,10,10,0.6)"; } }}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        {item.badge && !sidebarCollapsed && (
                          <span
                            className="ml-auto text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center leading-tight"
                            style={active ? { backgroundColor: "var(--color-cream)", color: brand.color } : { backgroundColor: brand.color, color: "var(--color-cream)" }}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.badge && sidebarCollapsed && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 text-[7px] font-bold flex items-center justify-center text-cream"
                            style={{ backgroundColor: brand.color, borderRadius: "50%" }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {/* Top bar */}
          <div className="px-3 py-2 border-b border-shell bg-cream/95 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
            <button
              onClick={toggleSidebar}
              className="text-xs text-sand hover:text-ink transition-colors flex items-center gap-1.5"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <><Menu className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Expand</span></> : <><PanelLeftClose className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Collapse</span></>}
            </button>
            <div className="flex items-center gap-3">
              {cartCount > 0 && (
                <button onClick={() => setCartOpen(true)} className="relative p-1" aria-label="Open shopping cart">
                  <ShoppingCart className="w-4 h-4 text-ink/60 hover:text-ink" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 text-cream text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: brand.color }}>
                    {cartCount}
                  </span>
                </button>
              )}
              <button type="button" className="relative" aria-label="Notifications">
                <Bell className="w-4 h-4 text-sand cursor-pointer hover:text-ink" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2" style={{ backgroundColor: brand.color }} />
              </button>
              <div className="w-7 h-7 flex items-center justify-center font-mono text-[10px] text-cream" style={{ backgroundColor: brand.color }}>
                A
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-cream">
            {view === "marketing" && <MarketingView {...viewProps} />}
            {view === "catalog" && <CatalogView {...viewProps} />}
            {view === "about" && <AboutView {...viewProps} />}
            {view === "checkout" && <CheckoutView {...viewProps} />}
            {view === "client-dashboard" && <ClientDashboardView {...viewProps} />}
            {view === "client-orders" && <ClientOrdersView {...viewProps} />}
            {view === "client-invoices" && <ClientInvoicesView {...viewProps} />}
            {view === "client-analytics" && <ClientAnalyticsView {...viewProps} />}
            {view === "client-referrals" && <ClientReferralsView {...viewProps} />}
            {view === "client-standing-orders" && <ClientStandingOrdersView {...viewProps} />}
            {view === "client-settings" && <ClientSettingsView {...viewProps} />}
            {view === "admin-dashboard" && <AdminDashboardView {...viewProps} />}
            {view === "admin-orders" && <AdminOrdersView {...viewProps} />}
            {view === "admin-fulfillment" && <FulfillmentBoardView {...viewProps} />}
            {view === "admin-clients" && <AdminClientsView {...viewProps} />}
            {view === "admin-invoices" && <AdminInvoicesView {...viewProps} />}
            {view === "admin-products" && <AdminProductsView {...viewProps} />}
            {view === "admin-leads" && <AdminLeadsView {...viewProps} />}
            {view === "admin-analytics" && <AdminAnalyticsView {...viewProps} />}
            {view === "admin-pricing" && <AdminPricingView {...viewProps} />}
            {view === "sms-demo" && <SmsDemoView {...viewProps} />}
          </div>
        </main>
      </div>

      {/* Cart Sidebar Overlay */}
      {cartOpen && (
        <CartSidebar
          cart={cart}
          brand={brand}
          onRemove={removeFromCart}
          onUpdateQty={updateQuantity}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setView("checkout"); }}
        />
      )}

      {/* Guided Tour Overlay */}
      {tourStep !== null && tourStep < TOUR_STEPS.length && !tourDismissed && (
        <TourOverlay
          step={tourStep}
          total={TOUR_STEPS.length}
          title={TOUR_STEPS[tourStep].title}
          description={TOUR_STEPS[tourStep].description}
          brandColor={brand.color}
          onNext={() => {
            if (tourStep < TOUR_STEPS.length - 1) {
              setTourStep(tourStep + 1);
            } else {
              setTourStep(null);
              setTourDismissed(true);
            }
          }}
          onSkip={() => {
            setTourStep(null);
            setTourDismissed(true);
          }}
        />
      )}

      {/* Lead capture banner — non-blocking bottom toast */}
      {leadCaptureVisible && !leadCaptureSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pointer-events-none">
          <div
            className="max-w-xl mx-auto bg-ink border border-shell px-4 py-3 pointer-events-auto"
            style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-mono text-xs text-cream/80 leading-relaxed">
                Like what you see? Get a personalized quote for your business.
              </p>
              <button
                onClick={dismissLeadCapture}
                className="flex-shrink-0 text-cream/40 hover:text-cream transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); submitLeadCapture(); }}
              className="flex items-center gap-2"
            >
              <input
                type="email"
                placeholder="you@company.com"
                value={leadCaptureEmail}
                onChange={(e) => setLeadCaptureEmail(e.target.value)}
                aria-label="Email address"
                className="flex-1 bg-white/10 border border-cream/20 text-cream font-mono text-xs px-3 py-2 placeholder:text-cream/30 focus:outline-none focus:border-cream/50"
                required
              />
              <button
                type="submit"
                disabled={leadCaptureSubmitting}
                className="bg-cream text-ink font-mono text-xs font-semibold px-4 py-2 hover:bg-white transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {leadCaptureSubmitting ? "Sending..." : "Get Quote"}
              </button>
            </form>
            <button
              onClick={dismissLeadCapture}
              className="font-mono text-[10px] text-cream/30 hover:text-cream/60 mt-2 transition-colors"
            >
              No thanks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export with Suspense wrapper ───────────────────────────────────────────

export function DemoPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 border border-shell border-t-[#2A52BE] animate-spin mx-auto mb-3" />
            <div className="font-mono text-sm text-sand">Loading your demo...</div>
          </div>
        </div>
      }
    >
      <DemoPortalInner />
    </Suspense>
  );
}
