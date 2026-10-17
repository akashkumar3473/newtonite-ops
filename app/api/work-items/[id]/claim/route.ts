
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import {
  getCurrentUser,
  getTeamMembership,
} from "@/src/lib/permissions";
import {
  TeamRole,
  WorkItemStatus,
} from "@/app/generated/prisma/client";

export const instant = false;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Work item ID is required." },
        { status: 400 },
      );
    }

    const item = await prisma.workItem.findUnique({
      where: { id },
      select: {
        id: true,
        teamId: true,
        assigneeId: true,
        status: true,
        version: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Work item not found." },
        { status: 404 },
      );
    }

    const membership = await getTeamMembership(
      user.id,
      item.teamId,
    );

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this team." },
        { status: 403 },
      );
    }

    if (membership.role === TeamRole.VIEWER) {
      return NextResponse.json(
        { error: "Your role cannot claim work items." },
        { status: 403 },
      );
    }

    if (item.status !== WorkItemStatus.OPEN) {
      return NextResponse.json(
        { error: "Only open work items can be claimed." },
        { status: 409 },
      );
    }

    if (item.assigneeId !== null) {
      return NextResponse.json(
        { error: "This work item is already assigned." },
        { status: 409 },
      );
    }

    const claimedItem = await prisma.$transaction(async (tx) => {
      // Atomic condition: only one concurrent request can win.
      const result = await tx.workItem.updateMany({
        where: {
          id: item.id,
          teamId: item.teamId,
          assigneeId: null,
          status: WorkItemStatus.OPEN,
          version: item.version,
        },
        data: {
          assigneeId: user.id,
          status: WorkItemStatus.IN_PROGRESS,
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        return null;
      }

      const updated = await tx.workItem.findUniqueOrThrow({
        where: { id: item.id },
      });

      await tx.activityEvent.create({
        data: {
          workItemId: item.id,
          actorId: user.id,
          action: "WORK_ITEM_CLAIMED",
          details: {
            previousAssigneeId: null,
            newAssigneeId: user.id,
            previousStatus: WorkItemStatus.OPEN,
            newStatus: WorkItemStatus.IN_PROGRESS,
            previousVersion: item.version,
            newVersion: item.version + 1,
          },
        },
      });

      return updated;
    });

    if (!claimedItem) {
      return NextResponse.json(
        {
          error:
            "This work item changed or was claimed by another user. Refresh and try again.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ item: claimedItem });
  } catch (error) {
    console.error("POST /api/work-items/[id]/claim failed:", error);

    return NextResponse.json(
      { error: "Unable to claim work item." },
      { status: 500 },
    );
  }
}
