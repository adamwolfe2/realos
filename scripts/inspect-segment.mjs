// Pull one page from the AL segments endpoint and print the raw shape so we
// can see which keys are actually present on each resolution.
// Usage: node scripts/inspect-segment.mjs
const SEGMENT_ID = "0023a33d-9bd9-4f3c-b8f5-a2adb94447bc";
const apiKey = process.env.CURSIVE_API_KEY;
if (!apiKey) {
  console.error("CURSIVE_API_KEY not set in env");
  process.exit(1);
}
const base = process.env.CURSIVE_API_URL ?? "https://api.audiencelab.io";
const url = `${base}/segments/${encodeURIComponent(SEGMENT_ID)}?page=1&page_size=3`;
console.log("GET", url);
const res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
console.log("Status:", res.status);
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.log("Non-JSON body:", text.slice(0, 500));
  process.exit(1);
}
console.log("\nTop-level keys:", Object.keys(json));
console.log("\nFull response (first 3 items):");
console.log(JSON.stringify(json, null, 2).slice(0, 4000));
