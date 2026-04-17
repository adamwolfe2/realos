import type { Home } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

export type Brand = {
  company: string;
  logo: string;
  color: string;
  domain: string;
};

export type ScrapeData = {
  companyName: string;
  companyDescription: string;
  industry: string;
  tagline: string;
  valuePropositions: string[];
  yearFounded: string;
  location: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  phone: string;
  email: string;
  address: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    linkedin: string;
    twitter: string;
  };
  products: Array<{
    name: string;
    description: string;
    price: string;
    category: string;
    imageUrl: string;
    unit: string;
    featured: boolean;
  }>;
  businessType: string;
  hasWholesale: boolean;
  deliveryInfo: string;
  paymentInfo: string;
  minimumOrder: string;
  testimonials: Array<{ quote: string; author: string; company: string }>;
  clientLogos: string[];
  certifications: string[];
  heroHeadline: string;
  heroSubheadline: string;
  ctaText: string;
  aboutSnippet: string;
};

export type SeedOrder = {
  number: string;
  client: string;
  items: string[];
  total: number;
  status: string;
  date: string;
  itemCount: number;
};

export type SeedClient = {
  name: string;
  tier: string;
  spend: string;
  health: string;
  orders: number;
  lastOrder: string;
};

export type SeedInvoice = {
  number: string;
  client: string;
  amount: number;
  status: string;
  due: string;
};

export type SeedData = {
  orders: SeedOrder[];
  clients: SeedClient[];
  invoices: SeedInvoice[];
};

export type CartItem = {
  product: ScrapeData["products"][0];
  quantity: number;
};

export type View =
  | "marketing"
  | "catalog"
  | "about"
  | "checkout"
  | "client-dashboard"
  | "client-orders"
  | "client-invoices"
  | "client-analytics"
  | "client-referrals"
  | "client-standing-orders"
  | "client-settings"
  | "admin-dashboard"
  | "admin-orders"
  | "admin-fulfillment"
  | "admin-clients"
  | "admin-invoices"
  | "admin-products"
  | "admin-leads"
  | "admin-analytics"
  | "admin-pricing"
  | "sms-demo";

export type ViewProps = {
  brand: Brand;
  data: ScrapeData;
  seed: SeedData;
  cart?: CartItem[];
  onAddToCart?: (product: ScrapeData["products"][0]) => void;
  onRemoveFromCart?: (productName: string) => void;
  onUpdateQuantity?: (productName: string, qty: number) => void;
  onOpenCart?: () => void;
  onNavigate?: (view: View) => void;
};

export type NavItem = {
  id: View;
  label: string;
  icon: typeof Home;
  group: string;
  badge?: number;
};
