import { prisma } from "../lib/db";

(async () => {
  const items = await prisma.proposalCatalogItem.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: {
      slug: true,
      kind: true,
      label: true,
      defaultPriceCents: true,
      active: true,
    },
  });
  console.log(`Catalog (${items.length} items):\n`);
  for (const i of items) {
    console.log(
      `  ${i.kind.padEnd(5)} ${i.slug.padEnd(28)} ${i.label.padEnd(34)} $${(i.defaultPriceCents / 100).toString().padStart(7)} ${i.active ? "" : "(inactive)"}`,
    );
  }
  await prisma.$disconnect();
})();
