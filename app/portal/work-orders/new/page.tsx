import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PageHeader } from "@/components/admin/page-header";
import { LogWorkOrderForm } from "@/components/portal/manual-entry-forms";

export const metadata: Metadata = { title: "Log work order" };
export const dynamic = "force-dynamic";

export default async function LogWorkOrderPage() {
  const gate = await requireModule("moduleResidents");
  if (gate) return gate;
  const scope = await requireScope();
  // Marketable only — see residents/new for rationale.
  const properties = await prisma.property.findMany({
    where: {
      ...marketablePropertyWhere(scope.orgId),
      ...(scope.allowedPropertyIds
        ? { id: { in: scope.allowedPropertyIds } }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            href="/portal/work-orders"
            className="hover:text-foreground transition-colors"
          >
            ← Work orders
          </Link>
        }
        title="Log work order"
        description="Manually log a maintenance request. If you connect AppFolio later, synced work orders appear alongside manual ones."
      />
      <LogWorkOrderForm properties={properties} />
    </div>
  );
}
