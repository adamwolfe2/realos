import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PageHeader } from "@/components/admin/page-header";
import { AddResidentForm } from "@/components/portal/manual-entry-forms";

export const metadata: Metadata = { title: "Add resident" };
export const dynamic = "force-dynamic";

export default async function AddResidentPage() {
  const gate = await requireModule("moduleResidents");
  if (gate) return gate;
  const scope = await requireScope();
  // Marketable only: non-ACTIVE (imported/excluded/archived) properties are
  // filtered out of every list page, so a record created against one would
  // silently never render anywhere.
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
            href="/portal/residents"
            className="hover:text-foreground transition-colors"
          >
            ← Residents
          </Link>
        }
        title="Add resident"
        description="Manually add a resident. If you connect AppFolio later, synced residents appear alongside manual ones."
      />
      <AddResidentForm properties={properties} />
    </div>
  );
}
