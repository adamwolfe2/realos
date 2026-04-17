"use client";

import dynamic from "next/dynamic";

export const LazyBuildDemo = dynamic(
  () => import("@/components/build-demo").then((m) => ({ default: m.BuildDemo })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[400px] animate-pulse"
        style={{ backgroundColor: "var(--border)" }}
      />
    ),
  }
);
