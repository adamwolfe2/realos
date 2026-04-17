"use client";

import dynamic from "next/dynamic";

export const LazyDemoLauncher = dynamic(
  () => import("@/components/demo-launcher").then((m) => ({ default: m.DemoLauncher })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[600px] animate-pulse"
        style={{ backgroundColor: "var(--border)" }}
      />
    ),
  }
);
