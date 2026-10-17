
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  WorkItemStatus,
  WorkItemType,
  Priority,
} from "../app/generated/prisma/client";

async function main() {
  // Find a team with at least two members
  const team = await prisma.team.findFirst({
    where: {
      memberships: {
        some: {},
      },
    },
    include: {
      memberships: {
        take: 2,
        select: { userId: true },
      },
    },
  });

  if (!team || team.memberships.length < 2) {
    throw new Error("A team with at least two members is required.");
  }

  const [member1, member2] = team.memberships;

  // Create a fresh work item for every test run
  const item = await prisma.workItem.create({
    data: {
      title: `TEST - Concurrent claim ${Date.now()}`,
      description: "Automated concurrent claim test",
      type: WorkItemType.TASK,
      priority: Priority.MEDIUM,
      status: WorkItemStatus.OPEN,
      teamId: team.id,
      createdById: member1.userId,
      assigneeId: null,
    },
  });

  console.log("Created fresh test item:", item.id);
  console.log("Starting simultaneous conditional updates...");

  // Simulate two users claiming the same item simultaneously
  const results = await Promise.all(
    [member1, member2].map(async (member) => {
      const result = await prisma.workItem.updateMany({
        where: {
          id: item.id,
          status: WorkItemStatus.OPEN,
          assigneeId: null,
          version: item.version,
        },
        data: {
          status: WorkItemStatus.IN_PROGRESS,
          assigneeId: member.userId,
          version: { increment: 1 },
        },
      });

      return {
        userId: member.userId,
        success: result.count === 1,
      };
    }),
  );

  console.table(results);

  const successes = results.filter((result) => result.success).length;

  const finalItem = await prisma.workItem.findUnique({
    where: { id: item.id },
    select: {
      status: true,
      assigneeId: true,
      version: true,
    },
  });

  console.log("Final item state:", finalItem);

  if (successes !== 1) {
    throw new Error(
      `FAIL: Expected exactly one winner, but got ${successes}.`,
    );
  }

  console.log("PASS: Exactly one concurrent claim won.");
}

main()
  .catch((error) => {
    console.error("Concurrent claim test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
