
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { WorkItemStatus, WorkItemType, Priority } from "../app/generated/prisma/client";

async function main() {
  const team = await prisma.team.findFirst({
    where: {
      memberships: { some: {} },
    },
    include: {
      memberships: {
        take: 1,
        select: { userId: true },
      },
    },
  });

  if (!team || team.memberships.length === 0) {
    throw new Error("No team with a member was found.");
  }

  const item = await prisma.workItem.create({
    data: {
      title: `TEST - Concurrent claim ${Date.now()}`,
      description: "Dedicated item for concurrent claim testing",
      type: WorkItemType.TASK,
      priority: Priority.MEDIUM,
      status: WorkItemStatus.OPEN,
      teamId: team.id,
      createdById: team.memberships[0].userId,
      assigneeId: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      assigneeId: true,
      version: true,
      teamId: true,
    },
  });

  console.log("Created fresh test item:");
  console.log(item);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
