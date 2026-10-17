
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { TeamRole } from "@/app/generated/prisma/client";

export type AuthorizedTeamMember = {
  userId: string;
  teamId: string;
  role: TeamRole;
};

export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

export async function getTeamMembership(
  userId: string,
  teamId: string,
): Promise<AuthorizedTeamMember | null> {
  return prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
    select: {
      userId: true,
      teamId: true,
      role: true,
    },
  });
}

export function canCreateWorkItems(role: TeamRole): boolean {
  return (
    role === TeamRole.ADMIN ||
    role === TeamRole.LEAD ||
    role === TeamRole.MEMBER
  );
}

export function canManageWorkItems(role: TeamRole): boolean {
  return role === TeamRole.ADMIN || role === TeamRole.LEAD;
}
