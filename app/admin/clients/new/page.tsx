import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { NewClientForm } from "@/components/admin/new-client-form";

export const metadata: Metadata = { title: "New client" };
export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requireAgency();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Clients
          </Link>
        }
        title="New client"
        description="Stand up a client organization end-to-end — Clerk workspace, build checklist, modules, and an owner invite. No intake form required."
      />
      <NewClientForm />
    </div>
  );
}
