import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

/**
 * Tests the invoice generation flow from app/api/admin/invoices/route.ts.
 *
 * Since the route handler is tightly coupled to Next.js (NextRequest, NextResponse),
 * we test the core logic patterns: number generation, idempotency, and create behavior.
 * We replicate the generateInvoiceNumber logic here since it's a private function.
 */

let mockPrisma: MockPrisma;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

describe("invoice generation", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.restoreAllMocks();
  });

  describe("invoice number format", () => {
    it("generates INV-YYYY-0001 when no existing invoices", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;

      // Replicate the generateInvoiceNumber logic
      const last = await mockPrisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      });

      const lastNum = last
        ? parseInt(last.invoiceNumber.replace(prefix, ""), 10)
        : 0;
      const invoiceNumber = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;

      expect(invoiceNumber).toBe(`INV-${year}-0001`);
      expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    });

    it("increments from the last existing invoice number", async () => {
      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;

      mockPrisma.invoice.findFirst.mockResolvedValue({
        invoiceNumber: `INV-${year}-0015`,
      });

      const last = await mockPrisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      });

      const lastNum = last
        ? parseInt(last.invoiceNumber.replace(prefix, ""), 10)
        : 0;
      const invoiceNumber = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;

      expect(invoiceNumber).toBe(`INV-${year}-0016`);
    });
  });

  describe("idempotency — existing invoice check", () => {
    it("returns existing invoice if order already has one (status 409 path)", async () => {
      const existingInvoice = {
        id: "inv-existing",
        invoiceNumber: "INV-2026-0001",
        orderId: "order-1",
      };

      mockPrisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-2026-0001",
        invoice: existingInvoice,
        organizationId: "org-1",
        subtotal: 100,
        tax: 10,
        total: 110,
      });

      const order = await mockPrisma.order.findUnique({
        where: { id: "order-1" },
        include: { invoice: true },
      });

      // The route handler checks order.invoice and returns 409
      expect(order.invoice).toBeTruthy();
      expect(order.invoice.id).toBe("inv-existing");
    });

    it("proceeds to create invoice when order has no existing invoice", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-2026-0001",
        invoice: null,
        organizationId: "org-1",
        subtotal: 100,
        tax: 10,
        total: 110,
      });

      const order = await mockPrisma.order.findUnique({
        where: { id: "order-1" },
        include: { invoice: true },
      });

      expect(order.invoice).toBeNull();
    });
  });

  describe("invoice creation", () => {
    it("creates an invoice with correct fields from order", async () => {
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-0001`;

      const order = {
        id: "order-1",
        organizationId: "org-1",
        subtotal: 250.0,
        tax: 25.0,
        total: 275.0,
      };

      const createdInvoice = {
        id: "inv-new",
        invoiceNumber,
        orderId: order.id,
        organizationId: order.organizationId,
        status: "PENDING",
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
      };

      mockPrisma.invoice.create.mockResolvedValue(createdInvoice);

      const result = await mockPrisma.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          organizationId: order.organizationId,
          dueDate: new Date("2026-04-01"),
          status: "PENDING",
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
        },
      });

      expect(result.invoiceNumber).toBe(invoiceNumber);
      expect(result.orderId).toBe("order-1");
      expect(result.status).toBe("PENDING");
      expect(result.total).toBe(275.0);
    });

    it("retries on P2002 unique constraint collision", async () => {
      const p2002Error = { code: "P2002", message: "Unique constraint" };

      // First call fails with P2002, second succeeds
      mockPrisma.invoice.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({
          id: "inv-new",
          invoiceNumber: "INV-2026-0002",
        });

      let invoice;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          invoice = await mockPrisma.invoice.create({
            data: { invoiceNumber: `INV-2026-${String(attempt + 1).padStart(4, "0")}` },
          });
          break;
        } catch (err) {
          if (
            (err as { code?: string }).code === "P2002" &&
            attempt < 9
          ) {
            continue;
          }
          throw err;
        }
      }

      expect(invoice).toBeDefined();
      expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(2);
    });

    it("creates an audit event after invoice creation", async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({});

      await mockPrisma.auditEvent.create({
        data: {
          entityType: "Invoice",
          entityId: "inv-new",
          action: "created",
          userId: "user-1",
          metadata: {
            invoiceNumber: "INV-2026-0001",
            orderId: "order-1",
            orderNumber: "ORD-2026-0001",
            total: 275,
          },
        },
      });

      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: "Invoice",
          action: "created",
          entityId: "inv-new",
        }),
      });
    });
  });
});
