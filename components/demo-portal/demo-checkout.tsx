"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  Clock,
  Minus,
  Loader2,
  X,
  Trash2,
} from "lucide-react";
import type { Brand, CartItem, ViewProps } from "./types";
import { getIndustryContext, parsePrice } from "./utils";

// ── Cart Sidebar ──────────────────────────────────────────────────────────

export function CartSidebar({ cart, brand, onRemove, onUpdateQty, onClose, onCheckout }: {
  cart: CartItem[];
  brand: Brand;
  onRemove: (name: string) => void;
  onUpdateQty: (name: string, qty: number) => void;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => s + c.quantity * parsePrice(c.product.price), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-cream border-l border-shell flex flex-col h-full">
        <div className="px-5 pt-5 pb-4 border-b border-shell flex items-center justify-between">
          <h3 className="text-xl font-bold text-ink">Your Order ({totalItems} items)</h3>
          <button onClick={onClose} className="p-1 text-sand hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6 px-5">
            {cart.map((item) => {
              const lineTotal = item.quantity * parsePrice(item.product.price);
              return (
                <div key={item.product.name} className="space-y-3 pb-6 border-b border-shell last:border-0">
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base leading-tight mb-1 text-ink">{item.product.name}</h4>
                      <p className="text-sm text-sand">{item.product.category}</p>
                      <p className="text-sm font-medium mt-1 text-ink">{item.product.price}{item.product.unit ? `/${item.product.unit}` : ""}</p>
                    </div>
                    <button onClick={() => onRemove(item.product.name)} className="h-8 w-8 flex items-center justify-center text-sand hover:text-ink">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onUpdateQty(item.product.name, Math.max(1, item.quantity - 1))} className="h-10 w-10 border border-shell flex items-center justify-center hover:border-ink transition-colors">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-base font-semibold w-10 text-center text-ink">{item.quantity}</span>
                      <button onClick={() => onUpdateQty(item.product.name, item.quantity + 1)} className="h-10 w-10 border border-shell flex items-center justify-center hover:border-ink transition-colors">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-lg font-bold text-ink">{formatCurrency(lineTotal)}</p>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-8 h-8 text-shell mx-auto mb-3" />
                <p className="text-sm text-sand">Your cart is empty</p>
              </div>
            )}
          </div>
        </div>
        {cart.length > 0 && (
          <div className="border-t border-shell px-5 py-5 space-y-4 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-ink">Total</span>
              <span className="text-2xl font-bold text-ink">{formatCurrency(totalPrice)}</span>
            </div>
            <button onClick={onCheckout} className="w-full h-12 text-base font-medium text-cream transition-opacity hover:opacity-85" style={{ backgroundColor: brand.color }}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Checkout View ─────────────────────────────────────────────────────────

export function CheckoutView({ brand, data, cart, onNavigate }: ViewProps) {
  const ctx = getIndustryContext(data.industry);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const items = (cart && cart.length > 0) ? cart : data.products.slice(0, 3).map((p) => ({ product: p, quantity: 2 }));
  const subtotal = items.reduce((s, c) => s + c.quantity * parsePrice(c.product.price), 0);
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = subtotal + tax;
  const orderNum = `ORD-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const invoiceNum = `INV-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const handlePlaceOrder = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setOrderPlaced(true);
    }, 1500);
  };

  if (orderPlaced) {
    return (
      <div className="p-6 bg-cream">
        <div className="max-w-lg mx-auto py-10 text-center">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: `${brand.color}12` }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: brand.color }} />
          </div>
          <h2 className="font-serif text-3xl font-bold text-ink mb-2">Order Confirmed!</h2>
          <p className="text-sm text-ink/50 mb-8">
            Your order has been placed successfully. A confirmation email has been sent.
          </p>

          {/* Order & Invoice details */}
          <div className="border border-shell bg-white text-left mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-shell">
              <div className="p-5 sm:border-r border-b sm:border-b-0 border-shell">
                <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Order Number</p>
                <p className="font-mono text-sm font-bold text-ink">{orderNum}</p>
              </div>
              <div className="p-5">
                <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Invoice Created</p>
                <p className="font-mono text-sm font-bold text-ink">{invoiceNum}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-shell">
              <div className="p-5 sm:border-r border-b sm:border-b-0 border-shell">
                <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Payment</p>
                <p className="text-xs font-medium text-ink">Net 30 Invoice</p>
              </div>
              <div className="p-5 sm:border-r border-b sm:border-b-0 border-shell">
                <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Items</p>
                <p className="text-xs font-medium text-ink">{items.length} products</p>
              </div>
              <div className="p-5">
                <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Total</p>
                <p className="font-serif text-lg font-bold text-ink">{formatCurrency(total)}</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-2">Items Ordered</p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.product.name} className="flex justify-between text-xs">
                    <span className="text-ink">{item.quantity}x {item.product.name}</span>
                    <span className="font-mono text-ink/70">{formatCurrency(item.quantity * parsePrice(item.product.price))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status timeline */}
          <div className="border border-shell bg-white text-left p-5 mb-6">
            <p className="text-[9px] tracking-[0.25em] uppercase text-sand font-mono mb-3">Order Status</p>
            <div className="space-y-3">
              {[
                { label: "Order Placed", time: "Just now", done: true },
                { label: "Invoice Created", time: "Just now", done: true },
                { label: "Confirmation Sent", time: "Just now", done: true },
                { label: "Processing & Fulfillment", time: "Next", done: false },
                { label: "Shipped", time: "Upcoming", done: false },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: brand.color }} />
                  ) : (
                    <Clock className="w-4 h-4 flex-shrink-0 text-shell" />
                  )}
                  <span className={`text-xs flex-1 ${step.done ? "text-ink font-medium" : "text-sand"}`}>{step.label}</span>
                  <span className="text-[9px] font-mono text-sand">{step.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onNavigate?.("client-orders")}
              className="flex-1 h-12 text-sm font-medium text-white transition-opacity hover:opacity-85"
              style={{ backgroundColor: brand.color }}
            >
              View My Orders
            </button>
            <button
              onClick={() => onNavigate?.("catalog")}
              className="flex-1 h-12 text-sm font-medium border border-shell text-ink hover:border-sand transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-cream">
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">Checkout</p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">Complete Your Order</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Order Form */}
        <div className="lg:col-span-3 space-y-4">
          <div className="border border-shell bg-cream p-6">
            <p className="text-xs font-medium text-ink/50 uppercase tracking-wider mb-4">Order Information</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Business Name", placeholder: ctx.businessPlaceholder },
                { label: "Contact Name", placeholder: "Full name" },
                { label: "Email", placeholder: "email@company.com" },
                { label: "Phone", placeholder: "(555) 000-0000" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-sand mb-1.5 block">{f.label}</label>
                  <input placeholder={f.placeholder} className="w-full h-10 px-3 border border-shell bg-white text-sm text-ink placeholder:text-sand focus:outline-none" style={{ borderColor: undefined }} onFocus={(e) => e.currentTarget.style.borderColor = brand.color} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-shell)"} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-[10px] tracking-[0.2em] uppercase text-sand mb-1.5 block">Delivery Address</label>
                <input placeholder="Street address, city, state, zip" className="w-full h-10 px-3 border border-shell bg-white text-sm text-ink placeholder:text-sand focus:outline-none" onFocus={(e) => e.currentTarget.style.borderColor = brand.color} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-shell)"} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] tracking-[0.2em] uppercase text-sand mb-1.5 block">Order Notes</label>
                <textarea rows={3} placeholder="Special instructions, delivery preferences..." className="w-full px-3 py-2 border border-shell bg-white text-sm text-ink placeholder:text-sand focus:outline-none resize-none" onFocus={(e) => e.currentTarget.style.borderColor = brand.color} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-shell)"} />
              </div>
            </div>
          </div>
          <div className="border border-shell bg-cream p-6">
            <p className="text-xs font-medium text-ink/50 uppercase tracking-wider mb-4">Payment Method</p>
            <div className="space-y-3">
              {["Net 30 Invoice", "Credit Card (Stripe)", "ACH Bank Transfer"].map((method, i) => (
                <label key={method} className="flex items-center gap-3 p-3 border border-shell cursor-pointer hover:border-sand transition-colors">
                  <div className="w-4 h-4 border-2 flex items-center justify-center" style={{ borderColor: i === 0 ? brand.color : "var(--color-shell)" }}>
                    {i === 0 && <div className="w-2 h-2" style={{ backgroundColor: brand.color }} />}
                  </div>
                  <span className="text-sm text-ink">{method}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {/* Order Summary */}
        <div className="lg:col-span-2">
          <div className="border border-shell bg-cream sticky top-16">
            <div className="px-5 py-4 border-b border-shell">
              <p className="text-xs font-medium text-ink/50 uppercase tracking-wider">Order Summary</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {items.map((item) => (
                <div key={item.product.name} className="flex items-center justify-between py-2 border-b border-shell/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.product.name}</p>
                    <p className="text-xs text-sand">{item.quantity} x {item.product.price}</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-ink">{formatCurrency(item.quantity * parsePrice(item.product.price))}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-shell space-y-2">
              <div className="flex justify-between text-sm"><span className="text-sand">Subtotal</span><span className="font-mono text-ink">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-sand">Tax (8.75%)</span><span className="font-mono text-ink">{formatCurrency(tax)}</span></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-shell"><span className="text-ink">Total</span><span className="font-serif text-xl text-ink">{formatCurrency(total)}</span></div>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={handlePlaceOrder}
                disabled={processing}
                className="w-full h-12 text-cream text-sm font-medium transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: brand.color }}
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <>Place Order</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
