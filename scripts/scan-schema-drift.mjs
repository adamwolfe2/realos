// Full schema↔DB drift scan: every model's scalar columns vs the prod table.
//   node --env-file=.env.production.local scripts/scan-schema-drift.mjs
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync("prisma/schema.prisma", "utf8");

const SCALARS = new Set([
  "String", "Int", "BigInt", "Float", "Boolean", "DateTime", "Json",
  "Decimal", "Bytes",
]);

// All enum names (so we can treat enum-typed fields as stored columns).
const enums = new Set(
  [...schema.matchAll(/enum\s+(\w+)\s+\{/g)].map((m) => m[1]),
);

// Parse every model + its @@map (table name override).
const models = [];
const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
let mm;
while ((mm = modelRe.exec(schema))) {
  const name = mm[1];
  const bodyText = mm[2];
  const mapMatch = bodyText.match(/@@map\("([^"]+)"\)/);
  const table = mapMatch ? mapMatch[1] : name;
  const cols = [];
  for (const raw of bodyText.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
    if (!/^[a-zA-Z_]\w*\s+\S/.test(line)) continue;
    if (line.includes("@relation")) continue;
    const parts = line.split(/\s+/);
    const fname = parts[0];
    const type = parts[1];
    if (type.endsWith("[]")) continue;
    const base = type.replace(/[?\[\]]/g, "");
    const colMatch = line.match(/@map\("([^"]+)"\)/);
    const col = colMatch ? colMatch[1] : fname;
    const stored = SCALARS.has(base) || enums.has(base) || !!colMatch;
    if (stored) cols.push({ fname, col, type });
  }
  models.push({ name, table, cols });
}

let totalDrift = 0;
for (const model of models) {
  const dbCols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = ${model.table}
  `.catch(() => null);
  if (dbCols === null) continue;
  if (dbCols.length === 0) {
    console.log(`⚠️  TABLE MISSING: ${model.name} (table "${model.table}") not found in DB`);
    totalDrift++;
    continue;
  }
  const dbSet = new Set(dbCols.map((c) => c.column_name));
  const missing = model.cols.filter((c) => !dbSet.has(c.col));
  if (missing.length) {
    totalDrift += missing.length;
    console.log(`\n${model.name} (table "${model.table}") — ${missing.length} missing column(s):`);
    for (const c of missing) console.log(`   ${c.fname}  col="${c.col}"  type=${c.type}`);
  }
}

console.log(`\n=== TOTAL DRIFT: ${totalDrift} missing column(s)/table(s) ===`);
if (totalDrift === 0) console.log("Schema and prod DB are in sync. ✅");
