import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({
  connectionString: (process.env.DATABASE_URL ?? "").replace(/-pooler\./, "."),
});
const prisma = new PrismaClient({ adapter });

const r = await prisma.organization.updateMany({
  where: { slug: "telegraph-commons-demo", name: "Telegraph Commons" },
  data: { modulePopups: true },
});
console.log("updated:", r.count);
await prisma.$disconnect();
