
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({
      where: { email: "user1@newtonite.local" },
      select: { id: true },
    });

    const team = await prisma.team.findUnique({
      where: { id: "cmvbb3rqy0000z8ukxl8le1am" },
      select: { id: true, name: true },
    });

    if (!user || !team) {
      throw new Error("Test user or team was not found.");
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId: team.id,
        },
      },
    });

    if (!membership) {
      throw new Error("Test user is not a member of the team.");
    }

    const item = await prisma.workItem.create({
      data: {
        title: "TEST - Concurrent claim verification",
        description: "Temporary test item for claim API verification.",
        type: "TASK",
        priority: "LOW",
        status: "OPEN",
        teamId: team.id,
        createdById: user.id,
        assigneeId: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeId: true,
        version: true,
      },
    });

    console.log("Created test item:", item);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
