// Find a user by name fragment or email. Handy for promoting someone when
// you only know their name, not their exact email.
// Usage: node scripts/find-user.mjs "James O'Connor"
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

const query = process.argv[2];
if (!query) {
  console.error('Usage: node scripts/find-user.mjs "<name or email fragment>"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

try {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      org: { select: { name: true, orgType: true } },
    },
    take: 20,
  });
  if (users.length === 0) {
    console.log(`No users matched "${query}".`);
    process.exit(0);
  }
  for (const u of users) {
    console.log(
      `${u.email} | ${u.firstName ?? ""} ${u.lastName ?? ""} | role=${u.role} | org=${u.org.name} (${u.org.orgType})`,
    );
  }
} finally {
  await prisma.$disconnect();
}
