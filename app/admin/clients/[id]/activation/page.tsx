import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ClientDetailTabs } from "@/app/admin/clients/[id]/client-detail-tabs";
import { loadClientActivation } from "@/lib/admin/client-activation";
import { requireAgencyStaffRead } from "@/lib/tenancy/scope";
import { ActivationTable } from "./activation-table";

export const metadata: Metadata = { title: "Client activation" };
export const dynamic = "force-dynamic";

export default async function ActivationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgencyStaffRead();
  const { id } = await params;
  const activation = await loadClientActivation(id, new Date());
  if (!activation) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <span aria-hidden="true">←</span> All clients
          </Link>
        }
        title={activation.client.name}
        description={`Read-only product readiness across ${activation.client.propertyCount} ${activation.client.propertyCount === 1 ? "property" : "properties"}.`}
      />

      <ClientDetailTabs
        orgId={activation.client.id}
        active="activation"
        propertiesCount={activation.client.propertyCount}
        failingSyncCount={0}
      />

      <ActivationTable rows={activation.rows} />
    </div>
  );
}
