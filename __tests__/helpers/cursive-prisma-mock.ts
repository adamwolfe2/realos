import { vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Stateful in-memory Prisma mock scoped to the Cursive/AudienceLab webhook.
 *
 * Covers CursiveIntegration, Visitor, Lead, WebhookEvent with just enough
 * findFirst/findUnique/create/update semantics to exercise the receiver's
 * dedupe + identity cascade logic, including P2002 unique-constraint throws
 * for WebhookEvent (source, bodyHash) and (source, eventFingerprint).
 *
 * Keep this small. It's test infra, not a Prisma re-implementation.
 */

type Row = Record<string, unknown>;

function p2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  // The receiver only inspects err.code === "P2002", but we set meta anyway.
  const err = new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    {
      code: "P2002",
      clientVersion: "test",
      meta: { target },
    }
  );
  return err;
}

function genId(prefix: string, counter: { n: number }): string {
  counter.n += 1;
  return `${prefix}-${counter.n}`;
}

function matchesWhere(row: Row, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR" && Array.isArray(v)) {
      const anyMatch = v.some((sub) =>
        matchesWhere(row, sub as Record<string, unknown>)
      );
      if (!anyMatch) return false;
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const vv = v as Record<string, unknown>;
      if ("in" in vv && Array.isArray(vv.in)) {
        if (!(vv.in as unknown[]).includes(row[k])) return false;
        continue;
      }
      if ("equals" in vv) {
        if (row[k] !== vv.equals) return false;
        continue;
      }
      // Fallback: treat as deep equality
      if (JSON.stringify(row[k]) !== JSON.stringify(v)) return false;
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

function applyUpdate(row: Row, data: Record<string, unknown>): Row {
  const next: Row = { ...row };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && "increment" in v) {
      const cur = (next[k] as number | undefined) ?? 0;
      next[k] =
        cur +
        Number((v as { increment: number }).increment);
      continue;
    }
    next[k] = v;
  }
  return next;
}

export interface CursivePrismaStore {
  cursiveIntegrations: Row[];
  visitors: Row[];
  leads: Row[];
  webhookEvents: Row[];
  visitorSessions: Row[];
  visitorEvents: Row[];
  counters: {
    visitor: { n: number };
    lead: { n: number };
    webhookEvent: { n: number };
    visitorSession: { n: number };
    visitorEvent: { n: number };
  };
}

export function createCursivePrismaMock() {
  const store: CursivePrismaStore = {
    cursiveIntegrations: [],
    visitors: [],
    leads: [],
    webhookEvents: [],
    visitorSessions: [],
    visitorEvents: [],
    counters: {
      visitor: { n: 0 },
      lead: { n: 0 },
      webhookEvent: { n: 0 },
      visitorSession: { n: 0 },
      visitorEvent: { n: 0 },
    },
  };

  const prisma = {
    cursiveIntegration: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        return (
          store.cursiveIntegrations.find((r) => matchesWhere(r, args.where)) ??
          null
        );
      }),
      findUnique: vi.fn(async (args: { where: Record<string, unknown> }) => {
        return (
          store.cursiveIntegrations.find((r) => matchesWhere(r, args.where)) ??
          null
        );
      }),
      update: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const idx = store.cursiveIntegrations.findIndex((r) =>
            matchesWhere(r, args.where)
          );
          if (idx === -1) throw new Error("integration not found");
          store.cursiveIntegrations[idx] = applyUpdate(
            store.cursiveIntegrations[idx],
            args.data
          );
          return store.cursiveIntegrations[idx];
        }
      ),
      updateMany: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          let count = 0;
          for (let i = 0; i < store.cursiveIntegrations.length; i += 1) {
            if (matchesWhere(store.cursiveIntegrations[i], args.where)) {
              store.cursiveIntegrations[i] = applyUpdate(
                store.cursiveIntegrations[i],
                args.data
              );
              count += 1;
            }
          }
          return { count };
        }
      ),
    },
    visitor: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        return store.visitors.find((r) => matchesWhere(r, args.where)) ?? null;
      }),
      update: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const idx = store.visitors.findIndex((r) =>
            matchesWhere(r, args.where)
          );
          if (idx === -1) throw new Error("visitor not found");
          store.visitors[idx] = applyUpdate(store.visitors[idx], args.data);
          return store.visitors[idx];
        }
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: genId("vis", store.counters.visitor),
          firstName: null,
          lastName: null,
          email: null,
          phone: null,
          hashedEmail: null,
          cursiveVisitorId: null,
          intentScore: 0,
          sessionCount: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          enrichedData: null,
          ...args.data,
        };
        store.visitors.push(row);
        return row;
      }),
    },
    lead: {
      findFirst: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          select?: Record<string, unknown>;
        }) => {
          const found = store.leads.find((r) => matchesWhere(r, args.where));
          if (!found) return null;
          if (args.select) {
            const out: Row = {};
            for (const k of Object.keys(args.select)) out[k] = found[k];
            return out;
          }
          return found;
        }
      ),
      update: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const idx = store.leads.findIndex((r) =>
            matchesWhere(r, args.where)
          );
          if (idx === -1) throw new Error("lead not found");
          store.leads[idx] = applyUpdate(store.leads[idx], args.data);
          return store.leads[idx];
        }
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: genId("lead", store.counters.lead),
          ...args.data,
        };
        store.leads.push(row);
        return row;
      }),
    },
    webhookEvent: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const data = args.data;
        const source = data.source;
        const bodyHash = data.bodyHash;
        const eventFingerprint = data.eventFingerprint;
        if (bodyHash) {
          const dup = store.webhookEvents.find(
            (r) => r.source === source && r.bodyHash === bodyHash
          );
          if (dup) throw p2002(["source", "bodyHash"]);
        }
        if (eventFingerprint) {
          const dup = store.webhookEvents.find(
            (r) =>
              r.source === source && r.eventFingerprint === eventFingerprint
          );
          if (dup) throw p2002(["source", "eventFingerprint"]);
        }
        const row: Row = {
          id: genId("wh", store.counters.webhookEvent),
          bodyHash: null,
          eventFingerprint: null,
          eventType: null,
          orgId: null,
          receivedAt: new Date(),
          ...data,
        };
        store.webhookEvents.push(row);
        return row;
      }),
      update: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const idx = store.webhookEvents.findIndex((r) =>
            matchesWhere(r, args.where)
          );
          if (idx === -1) throw new Error("webhookEvent not found");
          store.webhookEvents[idx] = applyUpdate(
            store.webhookEvents[idx],
            args.data
          );
          return store.webhookEvents[idx];
        }
      ),
      findUnique: vi.fn(
        async (args: { where: Record<string, unknown> }) => {
          return (
            store.webhookEvents.find((r) => matchesWhere(r, args.where)) ?? null
          );
        }
      ),
    },
    visitorSession: {
      findFirst: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          orderBy?: unknown;
          select?: unknown;
        }) => {
          const where = { ...args.where };
          // Strip the lastEventAt date filter — the mock matches simple
          // equality only, and we don't need real date semantics for the
          // unit tests that drive this path. Tests pre-seed sessions if
          // they want to assert "append vs new".
          delete (where as Record<string, unknown>).lastEventAt;
          const matches = store.visitorSessions.filter((r) =>
            matchesWhere(r, where as Record<string, unknown>)
          );
          // Approximate desc-by-lastEventAt by reversing insertion order.
          return matches.length > 0 ? matches[matches.length - 1] : null;
        }
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: genId("sess", store.counters.visitorSession),
          ...args.data,
        };
        store.visitorSessions.push(row);
        return row;
      }),
      update: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const idx = store.visitorSessions.findIndex((r) =>
            matchesWhere(r, args.where)
          );
          if (idx === -1) throw new Error("visitorSession not found");
          store.visitorSessions[idx] = applyUpdate(
            store.visitorSessions[idx],
            args.data
          );
          return store.visitorSessions[idx];
        }
      ),
    },
    visitorEvent: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: genId("ev", store.counters.visitorEvent),
          ...args.data,
        };
        store.visitorEvents.push(row);
        return row;
      }),
    },
  };

  function seedIntegration(row: Partial<Row> & { orgId: string }) {
    const full: Row = {
      installedOnDomain: null,
      lastEventAt: null,
      totalEventsCount: 0,
      ...row,
    };
    store.cursiveIntegrations.push(full);
    return full;
  }

  return { prisma, store, seedIntegration };
}

export type CursivePrismaMock = ReturnType<typeof createCursivePrismaMock>;
