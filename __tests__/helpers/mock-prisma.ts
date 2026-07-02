import { vi } from "vitest";

/**
 * Creates a mock Prisma client with vi.fn() stubs for common models.
 * Each model gets findFirst, findUnique, findMany, create, update, delete, count.
 */
function createModelMock() {
  return {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  };
}

export function createMockPrisma() {
  return {
    order: createModelMock(),
    orderItem: createModelMock(),
    invoice: createModelMock(),
    payment: createModelMock(),
    user: createModelMock(),
    organization: createModelMock(),
    webhookEndpoint: createModelMock(),
    webhookLog: createModelMock(),
    auditEvent: createModelMock(),
    lead: createModelMock(),
    application: createModelMock(),
    quote: createModelMock(),
    product: createModelMock(),
    project: createModelMock(),
    property: createModelMock(),
    userPropertyAccess: {
      ...createModelMock(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;
