import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  FileText,
  Users,
  BarChart3,
  MessageSquare,
  Heart,
  Home,
  Settings,
  Truck,
  Zap,
  Repeat,
  DollarSign,
} from "lucide-react";
import type { NavItem, View } from "./types";

// ── Nav Items ─────────────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  // Admin panel first -- this is the selling point
  { id: "admin-dashboard", label: "CEO Dashboard", icon: LayoutDashboard, group: "Admin Panel" },
  { id: "admin-orders", label: "Orders", icon: ShoppingCart, group: "Admin Panel", badge: 4 },
  { id: "admin-fulfillment", label: "Fulfillment", icon: Truck, group: "Admin Panel", badge: 3 },
  { id: "admin-clients", label: "Clients", icon: Users, group: "Admin Panel" },
  { id: "admin-invoices", label: "Invoices", icon: FileText, group: "Admin Panel", badge: 2 },
  { id: "admin-products", label: "Products", icon: Package, group: "Admin Panel" },
  { id: "admin-leads", label: "Leads", icon: Zap, group: "Admin Panel", badge: 5 },
  { id: "admin-pricing", label: "Pricing Rules", icon: DollarSign, group: "Admin Panel" },
  { id: "admin-analytics", label: "Analytics", icon: BarChart3, group: "Admin Panel" },
  // Client portal -- what their customers see
  { id: "client-dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Client Portal" },
  { id: "client-orders", label: "Orders", icon: ShoppingCart, group: "Client Portal" },
  { id: "client-invoices", label: "Invoices", icon: FileText, group: "Client Portal" },
  { id: "client-standing-orders", label: "Standing Orders", icon: Repeat, group: "Client Portal" },
  { id: "catalog", label: "Product Catalog", icon: Package, group: "Client Portal" },
  { id: "client-analytics", label: "Analytics", icon: BarChart3, group: "Client Portal" },
  { id: "client-referrals", label: "Refer & Earn", icon: Heart, group: "Client Portal" },
  { id: "client-settings", label: "Settings", icon: Settings, group: "Client Portal" },
  // Features
  { id: "sms-demo", label: "SMS Ordering", icon: MessageSquare, group: "Features" },
  { id: "marketing", label: "Marketing Site", icon: Home, group: "Features" },
];

// ── Guided Tour Steps ─────────────────────────────────────────────────────

export const TOUR_STEPS: { view: View; title: string; description: string }[] = [
  { view: "admin-dashboard", title: "CEO Command Center", description: "Real-time KPIs, revenue trends, client analytics — everything you need to run your operation from one screen." },
  { view: "catalog", title: "Product Catalog", description: "Your full product catalog with search, filters, and one-click add to cart. Clients can browse and order 24/7." },
  { view: "client-dashboard", title: "Client Dashboard", description: "Each client gets a personalized dashboard showing orders, spending, loyalty tier, and quick reorder." },
  { view: "sms-demo", title: "SMS Ordering", description: "Clients text their orders in natural language. AI parses them into structured orders automatically." },
  { view: "admin-analytics", title: "Business Analytics", description: "Revenue by category, client spending trends, and growth metrics — all updated in real-time." },
];
