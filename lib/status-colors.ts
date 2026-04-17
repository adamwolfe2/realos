// Monochrome status color system
// Uses grayscale tones for a clean, consistent B&W aesthetic

export const quoteStatusColors: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-500 border-neutral-200",
  SENT: "bg-neutral-200 text-neutral-700 border-neutral-300",
  ACCEPTED: "bg-neutral-900 text-white border-neutral-800",
  DECLINED: "bg-neutral-50 text-neutral-400 border-neutral-200",
  EXPIRED: "bg-neutral-50 text-neutral-300 border-neutral-200",
};

export const orderStatusColors: Record<string, string> = {
  PENDING: "bg-neutral-100 text-neutral-600 border-neutral-200",
  CONFIRMED: "bg-neutral-200 text-neutral-700 border-neutral-300",
  PACKED: "bg-neutral-300 text-neutral-800 border-neutral-400",
  SHIPPED: "bg-neutral-700 text-neutral-100 border-neutral-600",
  DELIVERED: "bg-neutral-900 text-white border-neutral-800",
  CANCELLED: "bg-neutral-50 text-neutral-400 border-neutral-200 line-through",
};

export const invoiceStatusColors: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-500 border-neutral-200",
  PENDING: "bg-neutral-200 text-neutral-700 border-neutral-300",
  PAID: "bg-neutral-900 text-white border-neutral-800",
  OVERDUE: "bg-neutral-700 text-neutral-100 border-neutral-600",
  CANCELLED: "bg-neutral-50 text-neutral-400 border-neutral-200",
};

export const tierColors: Record<string, string> = {
  NEW: "bg-neutral-100 text-neutral-600 border-neutral-200",
  REPEAT: "bg-neutral-300 text-neutral-800 border-neutral-400",
  VIP: "bg-neutral-900 text-white border-neutral-800",
};
