"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/portal/ui/side-drawer";
import { CreateNeighborhoodForm } from "./create-form";

type Property = { id: string; name: string };

// Relocates the permanent "Generate a new page" form into an on-demand
// drawer — same CreateNeighborhoodForm, same server action, zero behavior
// change. Only the container moved.
export function GenerateNeighborhoodDrawer({
  properties,
}: {
  properties: Property[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Generate neighborhood page
      </Button>
      <SideDrawer
        open={open}
        onOpenChange={setOpen}
        title="Generate a new page"
        description="Pick a neighborhood and (optionally) the property it should anchor on. Claude drafts the page; you edit before publishing."
        width="lg"
      >
        <CreateNeighborhoodForm properties={properties} />
      </SideDrawer>
    </>
  );
}
