"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Snowflake } from "lucide-react";
import type { Brand, ScrapeData, SeedData, SeedOrder } from "./types";

// ── useDemoData Hook ──────────────────────────────────────────────────────

export function useDemoData(): { brand: Brand; data: ScrapeData } {
  const params = useSearchParams();
  const [scraped, setScraped] = useState<ScrapeData | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("portal-demo-data");
      if (raw) setScraped(JSON.parse(raw));
    } catch {
      // sessionStorage unavailable or parse error
    }
  }, []);

  const color = params.get("color") || "1A1A1A";
  const brandColor = color.startsWith("#") ? color : `#${color}`;

  const brand: Brand = {
    company: scraped?.companyName || params.get("company") || "Your Company",
    logo: scraped?.logoUrl || params.get("logo") || "",
    color: scraped?.primaryColor || brandColor,
    domain: scraped?.domain || params.get("domain") || "yourcompany.com",
  };

  const fallbackProducts = [
    { name: "Premium Product A", description: "Our flagship offering", price: "$89.99", category: "Featured", imageUrl: "", unit: "each", featured: true },
    { name: "Premium Product B", description: "Best-selling item", price: "$64.99", category: "Featured", imageUrl: "", unit: "each", featured: true },
    { name: "Premium Product C", description: "Customer favorite", price: "$42.99", category: "Popular", imageUrl: "", unit: "each", featured: true },
    { name: "Premium Product D", description: "New arrival", price: "$119.99", category: "Popular", imageUrl: "", unit: "each", featured: true },
    { name: "Standard Product E", description: "Everyday essential", price: "$24.99", category: "Essentials", imageUrl: "", unit: "each", featured: false },
    { name: "Standard Product F", description: "Reliable choice", price: "$34.99", category: "Essentials", imageUrl: "", unit: "each", featured: false },
  ];

  const data: ScrapeData = scraped || {
    companyName: brand.company,
    companyDescription: `${brand.company} is a premier wholesale distributor serving businesses nationwide.`,
    industry: "Wholesale Distribution",
    tagline: "Quality products, delivered with care",
    valuePropositions: ["Premium Quality", "Fast Delivery", "Dedicated Support", "Competitive Pricing"],
    yearFounded: "2018",
    location: "United States",
    logoUrl: brand.logo,
    primaryColor: brand.color,
    secondaryColor: "#C8C0B4",
    accentColor: "#1A1614",
    domain: brand.domain,
    phone: "(555) 123-4567",
    email: `hello@${brand.domain}`,
    address: "123 Commerce St, Suite 100",
    socialLinks: { instagram: "", facebook: "", linkedin: "", twitter: "" },
    products: fallbackProducts,
    businessType: "B2B Wholesale",
    hasWholesale: true,
    deliveryInfo: "Same-day local delivery available",
    paymentInfo: "Net 30 terms available",
    minimumOrder: "$100",
    testimonials: [],
    clientLogos: [],
    certifications: [],
    heroHeadline: "",
    heroSubheadline: "",
    ctaText: "Browse Catalog",
    aboutSnippet: `${brand.company} has been a trusted partner for businesses looking for premium wholesale products. We combine quality sourcing with reliable logistics to ensure your business never misses a beat.`,
  };

  return { brand, data };
}

// ── Industry-Aware Content Helper ────────────────────────────────────────

export function getIndustryContext(industry: string) {
  const ind = (industry || "").toLowerCase();
  if (ind.includes("food") || ind.includes("truffle") || ind.includes("gourmet") || ind.includes("culinary") || ind.includes("restaurant") || ind.includes("catering")) {
    return { greeting: "Chef", personName: "Thomas Keller", roleName: "Executive Chef", locationLabel: "Primary Kitchen", locationAddr: "123 Main St, New York, NY 10001", secondaryLabel: "Prep Facility", secondaryAddr: "456 Industrial Blvd, Brooklyn, NY 11201", businessPlaceholder: "Restaurant name" };
  }
  if (ind.includes("beauty") || ind.includes("salon") || ind.includes("cosmetic") || ind.includes("skincare")) {
    return { greeting: "", personName: "Sarah Mitchell", roleName: "Salon Director", locationLabel: "Main Salon", locationAddr: "789 Beauty Blvd, Los Angeles, CA 90028", secondaryLabel: "Warehouse", secondaryAddr: "321 Commerce Way, Burbank, CA 91505", businessPlaceholder: "Salon or spa name" };
  }
  if (ind.includes("coffee") || ind.includes("tea") || ind.includes("beverage")) {
    return { greeting: "", personName: "James Park", roleName: "Operations Lead", locationLabel: "Roastery", locationAddr: "456 Roast Ave, Portland, OR 97201", secondaryLabel: "Distribution Hub", secondaryAddr: "789 Warehouse Ln, Portland, OR 97203", businessPlaceholder: "Cafe or roastery name" };
  }
  if (ind.includes("wine") || ind.includes("spirit") || ind.includes("liquor") || ind.includes("brewery")) {
    return { greeting: "", personName: "Marcus Chen", roleName: "Beverage Director", locationLabel: "Main Location", locationAddr: "321 Vine St, Napa, CA 94559", secondaryLabel: "Storage Facility", secondaryAddr: "654 Barrel Rd, Napa, CA 94558", businessPlaceholder: "Bar or restaurant name" };
  }
  // Generic B2B default
  return { greeting: "", personName: "Alex Morgan", roleName: "Operations Manager", locationLabel: "Main Office", locationAddr: "100 Commerce Dr, Suite 200, Austin, TX 78701", secondaryLabel: "Warehouse", secondaryAddr: "450 Distribution Way, Austin, TX 78745", businessPlaceholder: "Business name" };
}

// ── Price Parser ──────────────────────────────────────────────────────────

export function parsePrice(priceStr: string): number {
  const n = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 49.99 : n;
}

// ── generateSeedData ──────────────────────────────────────────────────────

export function generateSeedData(data: ScrapeData): SeedData {
  const products = data.products.length > 0 ? data.products : [];
  const industry = (data.industry || "").toLowerCase();

  // Generate industry-appropriate client names
  let clientNames: string[];
  if (industry.includes("food") || industry.includes("truffle") || industry.includes("gourmet") || industry.includes("culinary") || industry.includes("restaurant")) {
    clientNames = ["The Grand Hotel", "Bistro Napa", "Chef's Table NYC", "Pacific Grill", "La Maison", "Harbor Kitchen", "Blue Flame Steakhouse", "Golden Fork"];
  } else if (industry.includes("beauty") || industry.includes("salon") || industry.includes("cosmetic")) {
    clientNames = ["Luxe Salon & Spa", "Bloom Beauty Studio", "The Polished Look", "Serenity Aesthetics", "Radiant Skin Clinic", "Mane Street Salon", "Glow House", "Velvet Beauty Bar"];
  } else if (industry.includes("coffee") || industry.includes("tea") || industry.includes("beverage")) {
    clientNames = ["Morning Ritual Coffee", "The Daily Grind", "Steep & Sip", "Bean Counter Cafe", "Pour Over House", "Roast & Toast", "The Kettle Room", "Artisan Brews"];
  } else if (industry.includes("wine") || industry.includes("spirit") || industry.includes("liquor")) {
    clientNames = ["The Cellar Room", "Vintner's Table", "Pour Restaurant", "The Cask & Barrel", "Sommelier's Pick", "Noble Grape Bar", "The Tasting Room", "Heritage Wines"];
  } else {
    clientNames = ["Apex Industries", "Summit Group", "Meridian Co.", "Catalyst Partners", "Horizon LLC", "Atlas Commercial", "Nova Enterprises", "Pinnacle Corp"];
  }

  const statuses = ["Delivered", "Shipped", "Processing", "Pending"];
  const orders: SeedOrder[] = [];
  for (let i = 0; i < 8; i++) {
    const itemCount = 2 + Math.floor(Math.random() * 6);
    const orderItems: string[] = [];
    let total = 0;
    for (let j = 0; j < Math.min(itemCount, products.length || 3); j++) {
      const p = products[j % (products.length || 1)];
      const qty = 1 + Math.floor(Math.random() * 5);
      const price = parsePrice(p?.price || "$49.99");
      orderItems.push(`${qty}x ${p?.name || `Product ${j + 1}`}`);
      total += qty * price;
    }
    orders.push({
      number: `ORD-2026-${(847 - i).toString().padStart(4, "0")}`,
      client: clientNames[i % clientNames.length],
      items: orderItems,
      total: Math.round(total * 100) / 100,
      status: statuses[i % statuses.length],
      date: `Feb ${24 - i}`,
      itemCount,
    });
  }

  const tiers = ["VIP", "VIP", "REPEAT", "REPEAT", "NEW", "NEW", "REPEAT", "NEW"];
  const healths = ["Champion", "Champion", "Healthy", "Healthy", "At Risk", "New", "Healthy", "New"];
  const spends = [142350, 98200, 34500, 28700, 12400, 4200, 19800, 2800];

  const clients = clientNames.slice(0, 8).map((name, i) => ({
    name,
    tier: tiers[i],
    spend: formatCurrency(spends[i]),
    health: healths[i],
    orders: [67, 45, 23, 19, 14, 5, 16, 3][i],
    lastOrder: `Feb ${24 - i}`,
  }));

  const invStatuses = ["Paid", "Pending", "Pending", "Overdue", "Paid", "Paid", "Pending", "Overdue"];
  const invoices = orders.slice(0, 8).map((o, i) => ({
    number: `INV-2026-${(312 - i).toString().padStart(4, "0")}`,
    client: o.client,
    amount: o.total,
    status: invStatuses[i],
    due: i === 3 || i === 7 ? `Feb ${14 + i}` : `Mar ${20 + i}`,
  }));

  return { orders, clients, invoices };
}

// ── Status Badge Helper ───────────────────────────────────────────────────

export function statusStyle(status: string, brandColor: string): React.CSSProperties {
  switch (status) {
    case "Delivered":
    case "Paid":
    case "Champion":
    case "VIP":
      return { backgroundColor: brandColor, color: "var(--color-cream)", borderColor: brandColor };
    case "Shipped":
    case "Healthy":
    case "REPEAT":
      return { backgroundColor: `${brandColor}18`, color: brandColor, borderColor: `${brandColor}30` };
    case "Processing":
      return { backgroundColor: `${brandColor}12`, color: brandColor, borderColor: `${brandColor}25` };
    case "Pending":
    case "New":
    case "NEW":
      return { backgroundColor: "transparent", color: "#C8C0B4", borderColor: "var(--color-shell)" };
    case "Overdue":
    case "At Risk":
      return { backgroundColor: "#FEF3C7", color: "#92400E", borderColor: "#FDE68A" };
    default:
      return { backgroundColor: "transparent", color: "#C8C0B4", borderColor: "var(--color-shell)" };
  }
}

export function StatusBadge({ status, brandColor }: { status: string; brandColor: string }) {
  return (
    <span
      className="border text-[10px] uppercase tracking-wider px-2 py-0.5 font-mono"
      style={statusStyle(status, brandColor)}
    >
      {status}
    </span>
  );
}

// ── Shared Product Image Placeholder ──────────────────────────────────────

export function ProductImage({
  product,
  brandColor,
  size = "md",
}: {
  product: { name: string; imageUrl?: string; category?: string };
  brandColor: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "w-12 h-12" : size === "lg" ? "w-full h-40" : "w-16 h-16";
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-5xl" : "text-2xl";
  const hasImage = product.imageUrl && product.imageUrl.trim() !== "";

  return (
    <div
      className={`${sizeClass} flex items-center justify-center font-serif ${textSize} flex-shrink-0 relative overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, ${brandColor}08 0%, ${brandColor}15 100%)`,
        borderBottom: size === "lg" ? `1px solid ${brandColor}12` : undefined,
      }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover relative z-10"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      {/* Clean monogram fallback -- always rendered behind image */}
      <span
        className="absolute inset-0 flex items-center justify-center font-bold select-none"
        style={{ color: `${brandColor}25`, letterSpacing: "0.05em" }}
      >
        {product.name.charAt(0).toUpperCase()}
      </span>
      {/* Subtle category label for larger sizes */}
      {size === "lg" && product.category && (
        <span
          className="absolute bottom-2 right-2 font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5"
          style={{ color: `${brandColor}50`, backgroundColor: `${brandColor}06` }}
        >
          {product.category}
        </span>
      )}
    </div>
  );
}

// ── Placeholder View ──────────────────────────────────────────────────────

import { Package } from "lucide-react";

export function PlaceholderView({ title, description }: { brand: Brand; title: string; description: string }) {
  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Included Module</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">{title}</h2>
      </div>
      <div className="border border-dashed border-shell bg-cream p-10 text-center">
        <Package className="w-10 h-10 text-shell mx-auto mb-4" />
        <p className="text-sm text-ink/60 mb-2">{description}</p>
        <p className="text-xs text-sand">This module is fully built during your portal deployment.</p>
      </div>
    </div>
  );
}
