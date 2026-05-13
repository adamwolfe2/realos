// Re-export of the canonical PageHeader so portal-tree code can import from
// the portal/ui index without crossing into components/admin. The actual
// implementation lives in components/admin/page-header.tsx and is shared
// between /admin and /portal so both surfaces stay in lockstep.
export { PageHeader, SectionCard } from "@/components/admin/page-header";
