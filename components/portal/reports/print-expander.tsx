"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// PrintExpander
//
// Force-opens every <details> inside the report before window.print() fires
// so collapsed insight groups render in full in PDFs / paper. After print,
// each <details> is restored to its original state so the on-screen view
// stays as the operator left it.
//
// Mounted once per report page. No visual output.
// ---------------------------------------------------------------------------
export function PrintExpander() {
  React.useEffect(() => {
    const previouslyOpen = new WeakSet<HTMLDetailsElement>();

    const handleBeforePrint = () => {
      const all = document.querySelectorAll<HTMLDetailsElement>(
        "article.report-article details",
      );
      all.forEach((d) => {
        if (d.open) previouslyOpen.add(d);
        d.open = true;
      });
    };

    const handleAfterPrint = () => {
      const all = document.querySelectorAll<HTMLDetailsElement>(
        "article.report-article details",
      );
      all.forEach((d) => {
        if (!previouslyOpen.has(d)) d.open = false;
      });
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    // Chrome's print media query change event also fires for save-as-PDF.
    let mql: MediaQueryList | null = null;
    const mqlHandler = (e: MediaQueryListEvent) => {
      if (e.matches) handleBeforePrint();
      else handleAfterPrint();
    };
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("print");
      mql.addEventListener?.("change", mqlHandler);
    }

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      mql?.removeEventListener?.("change", mqlHandler);
    };
  }, []);

  return null;
}
