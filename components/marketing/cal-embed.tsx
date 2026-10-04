"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import * as React from "react";

// Everything that touches @calcom/embed-react lives here so the root layout
// (CalDemoProvider) only pulls it in via dynamic import: on first "Book a
// demo" click, or when the pre-warm embed mounts on marketing pages.

export const CAL_NAMESPACE = "leasestack-intro";

export async function openCalModal(slug: string): Promise<void> {
  const cal = await getCalApi({ namespace: CAL_NAMESPACE });
  cal("modal", { calLink: slug, config: { layout: "month_view" } });
}

/** Registers the Cal UI config and pre-renders the embed off-screen. */
export default function CalWarmEmbed({ slug }: { slug: string }) {
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      if (cancelled) return;
      cal("ui", {
        // Light, brand-neutral UI on the embed; just set the brand color.
        hideEventTypeDetails: false,
        layout: "month_view",
        styles: {
          branding: { brandColor: "#0f62fe" },
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div aria-hidden="true" className="hidden">
      <Cal
        namespace={CAL_NAMESPACE}
        calLink={slug}
        style={{ width: "100%", height: "100%" }}
        config={{ layout: "month_view" }}
      />
    </div>
  );
}
