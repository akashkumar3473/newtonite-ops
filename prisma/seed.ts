
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  TeamRole,
  WorkItemType,
  Priority,
  WorkItemStatus,
} from "../app/generated/prisma/client";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await hash(
    "DemoPass123!",
    12
  );

  const teamNames = [
    "IT Operations",
    "Customer Support",
    "Finance",
    "Compliance",
  ];

  const teams = [];

  for (const name of teamNames) {
    const team = await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    teams.push(team);
  }

  const users = [];

  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.upsert({
      where: { email: `user${i}@newtonite.local` },
      update: {},
      create: {
        name: `Demo User ${i}`,
        email: `user${i}@newtonite.local`,
        passwordHash,
      },
    });

    users.push(user);
  }

  const roles = [
    TeamRole.ADMIN,
    TeamRole.LEAD,
    TeamRole.MEMBER,
    TeamRole.VIEWER,
  ];

  for (let i = 0; i < users.length; i++) {
    const team = teams[i % teams.length];

    await prisma.membership.upsert({
      where: {
        userId_teamId: {
          userId: users[i].id,
          teamId: team.id,
        },
      },
      update: {},
      create: {
        userId: users[i].id,
        teamId: team.id,
        role: roles[i % roles.length],
      },
    });
  }

  const titles = [
    "Investigate server outage",
    "Resolve customer payment failure",
    "Review suspicious transaction",
    "Check compliance documentation",
    "Investigate login failures",
    "Restore internal service",
    "Review failed payment batch",
    "Respond to customer complaint",
    "Audit access permissions",
    "Update incident documentation",
    "Investigate API latency",
    "Review refund request",
    "Verify account records",
    "Resolve email delivery issue",
    "Check data processing errors",
    "Review transaction discrepancy",
    "Investigate network issue",
    "Validate customer records",
    "Review operational alert",
    "Complete system maintenance",
  ];

  const statuses = [
    WorkItemStatus.OPEN,
    WorkItemStatus.IN_PROGRESS,
    WorkItemStatus.AWAITING_APPROVAL,
    WorkItemStatus.RESOLVED,
  ];


    for (let i = 0; i < titles.length; i++) {
    const teamIndex = i % teams.length;
    const team = teams[teamIndex];

    // Select only users who belong to this team.
    const teamMembers = users.filter(
        (_, userIndex) => (userIndex + 1) % teams.length === teamIndex,
    );

    const creator = teamMembers[i % teamMembers.length];
    const assignee = teamMembers[(i + 1) % teamMembers.length];

    const item = await prisma.workItem.create({
        data: {
        title: titles[i],
        description: `Demo work item ${i + 1}`,
        type:
            i % 2 === 0
            ? WorkItemType.INCIDENT
            : WorkItemType.TASK,
        priority:
            i % 5 === 0
            ? Priority.CRITICAL
            : i % 3 === 0
                ? Priority.HIGH
                : Priority.MEDIUM,
        status: statuses[i % statuses.length],
        teamId: team.id,
        createdById: creator.id,
        assigneeId: assignee.id,
        activities: {
            create: {
            actorId: creator.id,
            action: "CREATED",
            details: {
                message: "Seeded demo work item",
            },
            },
        },
        },
    });

    console.log(`Created: ${item.title}`);
    }


  console.log("Seed completed successfully.");
  console.log(`Teams: ${teams.length}`);
  console.log(`Users: ${users.length}`);
  console.log(`Work items: ${titles.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
