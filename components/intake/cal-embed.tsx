"use client";

import { useEffect } from "react";

// CalFunction + Window augmentation are declared globally in types/vendor.d.ts.

const CAL_NAMESPACE = process.env.NEXT_PUBLIC_CAL_NAMESPACE ?? "realos";
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK ?? "adamwolfe/realos";

// ---------------------------------------------------------------------------
// Inline Cal.com embed. Forked from Wholesail; removed the portal-config
// dependency and swapped the namespace/link to real-estate defaults.
// ---------------------------------------------------------------------------

export function CalEmbed({ name, email }: { name?: string; email?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__calPortalInitialized) return;
    window.__calPortalInitialized = true;

    if (!window.Cal) {
      (function (C: Window, A: string, L: string) {
        const p = function (a: CalFunction, ar: IArguments | unknown[]) {
          (a.q as unknown[]).push(ar);
        };
        const d = C.document;
        C.Cal =
          C.Cal ||
          (function (this: CalFunction) {
            const cal = C.Cal!;
            const ar = arguments;
            if (!cal.loaded) {
              cal.ns = {} as Record<string, CalFunction>;
              cal.q = cal.q || [];
              d.head.appendChild(d.createElement("script")).setAttribute(
                "src",
                A
              );
              cal.loaded = true;
            }
            if (ar[0] === L) {
              const api: CalFunction = function () {
                p(api, arguments);
              } as CalFunction;
              const namespace = ar[1] as string;
              api.q = api.q || [];
              if (typeof namespace === "string") {
                cal.ns![namespace] = cal.ns![namespace] || api;
                p(cal.ns![namespace], ar);
                p(cal, ["initNamespace", namespace]);
              } else p(cal, ar);
              return;
            }
            p(cal, ar);
          } as CalFunction);
      })(window, "https://app.cal.com/embed/embed.js", "init");
    }

    const Cal = window.Cal!;
    Cal("init", CAL_NAMESPACE, { origin: "https://app.cal.com" });
    Cal.ns![CAL_NAMESPACE]("inline", {
      elementOrSelector: "#intake-cal-inline",
      config: {
        layout: "month_view",
        useSlotsViewOnSmallScreen: "true",
        theme: "light",
        ...(name || email
          ? { prefill: { name: name ?? "", email: email ?? "" } }
          : {}),
      },
      calLink: CAL_LINK,
    });
    Cal.ns![CAL_NAMESPACE]("ui", {
      theme: "light",
      cssVarsPerTheme: { light: { "cal-brand": "#2563eb" } },
      hideEventTypeDetails: true,
      layout: "month_view",
    });
  }, [email, name]);

  return (
    <div
      id="intake-cal-inline"
      style={{ width: "100%", minHeight: "660px", overflow: "auto" }}
    />
  );
}
