import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { currentTypeIs } from "@/components/audiences/push-panel";

// Regression for PORTAL-GROWTH-D002: the push button icon already switched
// to a download icon for CSV_DOWNLOAD destinations, but the label text
// never left "Push now" / "Pushing…" — so a CSV destination showed a
// download icon next to text that says "Push now", which reads as broken.

const ROOT = path.resolve(__dirname, "..");

describe("currentTypeIs", () => {
  const destinations = [
    { id: "d1", name: "Meta Ads", type: "META_ADS" },
    { id: "d2", name: "CSV export", type: "CSV_DOWNLOAD" },
  ];

  it("is true only for the matching destination + type", () => {
    expect(currentTypeIs("d2", destinations, "CSV_DOWNLOAD")).toBe(true);
    expect(currentTypeIs("d1", destinations, "CSV_DOWNLOAD")).toBe(false);
    expect(currentTypeIs("unknown", destinations, "CSV_DOWNLOAD")).toBe(false);
  });
});

describe("push-panel — button label matches the icon per destination type", () => {
  it("renders Download/Downloading… in the CSV_DOWNLOAD branch, not the generic Push copy", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "components/audiences/push-panel.tsx"),
      "utf-8",
    );
    // The CSV_DOWNLOAD branch (right after <Download />) must render
    // "Download" / "Downloading…" text, not "Push now" / "Pushing…".
    const downloadBranch = src.split("<Download />")[1]?.split("<Send />")[0] ?? "";
    expect(downloadBranch).toMatch(/Downloading…/);
    expect(downloadBranch).toMatch(/Download/);
    expect(downloadBranch).not.toMatch(/Push now/);
  });
});
