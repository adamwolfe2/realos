import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

const adapter = new PrismaNeonHttp(
  process.env.DATABASE_URL!,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      clerkUserId: true,
      role: true,
      orgId: true,
      org: { select: { name: true, orgType: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("Users in DB:");
  for (const u of users) {
    console.log(
      `  ${u.email}  role=${u.role}  clerk=${u.clerkUserId}  org=${u.org?.name} (${u.org?.orgType})`,
    );
  }
}

main().finally(() => prisma.$disconnect());
