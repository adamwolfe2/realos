"use client";

import {
  Package,
  Truck,
  ClipboardList,
  CheckCircle2,
  Clock,
  GripVertical,
  AlertTriangle,
  Printer,
} from "lucide-react";
import type { ViewProps } from "./types";

// ── Types ────────────────────────────────────────────────────────────────

type Priority = "normal" | "rush";

type FulfillmentOrder = {
  number: string;
  client: string;
  itemCount: number;
  total: string;
  priority: Priority;
  timeAgo: string;
  tracking?: string;
};

type Column = {
  id: string;
  title: string;
  icon: typeof Package;
  orders: FulfillmentOrder[];
  action?: { label: string; icon: typeof Printer };
};

// ── Static Data Builder ──────────────────────────────────────────────────

function buildColumns(clientNames: string[]): Column[] {
  const c = (i: number) => clientNames[i % clientNames.length];

  return [
    {
      id: "new",
      title: "New Orders",
      icon: Package,
      orders: [
        { number: "ORD-2026-0851", client: c(0), itemCount: 4, total: "$428.50", priority: "rush", timeAgo: "12m ago" },
        { number: "ORD-2026-0850", client: c(1), itemCount: 2, total: "$189.00", priority: "normal", timeAgo: "45m ago" },
        { number: "ORD-2026-0849", client: c(2), itemCount: 7, total: "$1,240.75", priority: "normal", timeAgo: "1h ago" },
      ],
    },
    {
      id: "picking",
      title: "Picking",
      icon: ClipboardList,
      orders: [
        { number: "ORD-2026-0848", client: c(3), itemCount: 3, total: "$312.00", priority: "rush", timeAgo: "2h ago" },
        { number: "ORD-2026-0847", client: c(4), itemCount: 5, total: "$567.25", priority: "normal", timeAgo: "2.5h ago" },
      ],
      action: { label: "Generate Pick List", icon: ClipboardList },
    },
    {
      id: "packed",
      title: "Packed",
      icon: CheckCircle2,
      orders: [
        { number: "ORD-2026-0846", client: c(5), itemCount: 6, total: "$892.00", priority: "normal", timeAgo: "3h ago" },
        { number: "ORD-2026-0845", client: c(6), itemCount: 2, total: "$145.50", priority: "rush", timeAgo: "3.5h ago" },
      ],
      action: { label: "Print Labels", icon: Printer },
    },
    {
      id: "shipped",
      title: "Shipped",
      icon: Truck,
      orders: [
        { number: "ORD-2026-0844", client: c(7), itemCount: 4, total: "$634.00", priority: "normal", timeAgo: "5h ago", tracking: "1Z999AA10123456784" },
      ],
    },
  ];
}

// ── Order Card ───────────────────────────────────────────────────────────

function OrderCard({ order, brandColor }: { order: FulfillmentOrder; brandColor: string }) {
  const isRush = order.priority === "rush";

  return (
    <div
      className="border border-shell bg-cream p-3 mb-2 relative"
      style={isRush ? { borderLeftWidth: 3, borderLeftColor: brandColor } : undefined}
    >
      {/* Drag handle hint */}
      <div className="absolute top-3 right-2 text-shell">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs font-bold text-ink">{order.number}</span>
        {isRush && (
          <span
            className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 font-bold"
            style={{ backgroundColor: brandColor, color: "var(--color-cream)" }}
          >
            Rush
          </span>
        )}
      </div>

      {/* Client */}
      <p className="text-sm text-ink/80 font-medium mb-1.5 pr-5 truncate">{order.client}</p>

      {/* Details row */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3">
          <span className="text-sand font-mono">{order.itemCount} items</span>
          <span className="text-ink font-mono font-bold">{order.total}</span>
        </div>
        <div className="flex items-center gap-1 text-sand">
          <Clock className="w-3 h-3" />
          <span className="font-mono text-[10px]">{order.timeAgo}</span>
        </div>
      </div>

      {/* Tracking (shipped only) */}
      {order.tracking && (
        <div className="mt-2 pt-2 border-t border-shell flex items-center gap-1.5">
          <Truck className="w-3 h-3 text-sand" />
          <span className="font-mono text-[10px] text-sand truncate">{order.tracking}</span>
        </div>
      )}
    </div>
  );
}

// ── Column Header ────────────────────────────────────────────────────────

function ColumnHeader({
  title,
  icon: Icon,
  count,
  brandColor,
}: {
  title: string;
  icon: typeof Package;
  count: number;
  brandColor: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-shell">
      <Icon className="w-4 h-4 text-ink/60" />
      <span className="font-serif font-bold text-sm text-ink">{title}</span>
      <span
        className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 min-w-[20px] text-center"
        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
      >
        {count}
      </span>
    </div>
  );
}

// ── Column Action Button ─────────────────────────────────────────────────

function ColumnAction({
  label,
  icon: Icon,
  brandColor,
}: {
  label: string;
  icon: typeof Printer;
  brandColor: string;
}) {
  return (
    <button
      className="w-full mt-2 px-3 py-2 font-mono text-[10px] uppercase tracking-wide border flex items-center justify-center gap-1.5 transition-colors hover:opacity-80"
      style={{ borderColor: brandColor, color: brandColor, backgroundColor: `${brandColor}08` }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ── Main View ────────────────────────────────────────────────────────────

export function FulfillmentBoardView({ brand, seed }: ViewProps) {
  const clientNames = seed.clients.map((c) => c.name);
  const columns = buildColumns(clientNames);
  const totalOrders = columns.reduce((sum, col) => sum + col.orders.length, 0);
  const rushCount = columns.reduce(
    (sum, col) => sum + col.orders.filter((o) => o.priority === "rush").length,
    0,
  );

  return (
    <div className="p-4 sm:p-6 bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">
            Warehouse Operations
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
            Fulfillment Board
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {rushCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] font-mono uppercase tracking-wide"
              style={{ borderColor: brand.color, color: brand.color, backgroundColor: `${brand.color}08` }}
            >
              <AlertTriangle className="w-3 h-3" />
              {rushCount} rush
            </div>
          )}
          <div className="px-2.5 py-1.5 border border-shell text-[10px] font-mono uppercase tracking-wide text-sand">
            {totalOrders} orders in pipeline
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.id} className="border border-shell bg-cream p-3 min-h-[200px]">
            <ColumnHeader
              title={col.title}
              icon={col.icon}
              count={col.orders.length}
              brandColor={brand.color}
            />
            <div>
              {col.orders.map((order) => (
                <OrderCard key={order.number} order={order} brandColor={brand.color} />
              ))}
            </div>
            {col.action && (
              <ColumnAction
                label={col.action.label}
                icon={col.action.icon}
                brandColor={brand.color}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}