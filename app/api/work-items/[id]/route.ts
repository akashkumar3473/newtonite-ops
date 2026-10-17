
import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import {
  canManageWorkItems,
  getCurrentUser,
  getTeamMembership,
} from "@/src/lib/permissions";
import {
  Priority,
  TeamRole,
  WorkItemStatus,
  WorkItemType,
} from "@/app/generated/prisma/client";

export const instant = false;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statuses = new Set<string>(Object.values(WorkItemStatus));
const priorities = new Set<string>(Object.values(Priority));
const types = new Set<string>(Object.values(WorkItemType));

const transitions: Record<WorkItemStatus, WorkItemStatus[]> = {
  OPEN: [WorkItemStatus.IN_PROGRESS],
  IN_PROGRESS: [
    WorkItemStatus.OPEN,
    WorkItemStatus.AWAITING_APPROVAL,
    WorkItemStatus.RESOLVED,
  ],
  AWAITING_APPROVAL: [
    WorkItemStatus.IN_PROGRESS,
    WorkItemStatus.RESOLVED,
  ],
  RESOLVED: [
    WorkItemStatus.IN_PROGRESS,
    WorkItemStatus.CLOSED,
  ],
  CLOSED: [],
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function findItem(id: string, userId: string) {
  const item = await prisma.workItem.findUnique({
    where: { id },
    include: {
      team: { select: { name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!item) return { item: null, membership: null };

  const membership = await getTeamMembership(userId, item.teamId);
  return { item, membership };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Authentication required.", 401);

    const { id } = await params;
    const { item, membership } = await findItem(id, user.id);

    if (!item) return fail("Work item not found.", 404);
    if (!membership) {
      return fail("You do not have access to this team.", 403);
    }

    return NextResponse.json({ item });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET work item failed:", error);
    return fail("Unable to retrieve work item.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Authentication required.", 401);

    const { id } = await params;
    const { item, membership } = await findItem(id, user.id);

    if (!item) return fail("Work item not found.", 404);
    if (!membership) {
      return fail("You do not have access to this team.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be valid JSON.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return fail("Request body must be a JSON object.", 400);
    }

    const data = body as Record<string, unknown>;
    const allowedKeys = [
      "version",
      "title",
      "description",
      "type",
      "priority",
      "status",
      "dueDate",
      "assigneeId",
    ];

    if (Object.keys(data).some((key) => !allowedKeys.includes(key))) {
      return fail("Request contains unsupported fields.", 400);
    }

    if (
      !Number.isSafeInteger(data.version) ||
      typeof data.version !== "number" ||
      data.version < 1
    ) {
      return fail("A valid version is required.", 400);
    }

    if (data.version !== item.version) {
      return fail("Work item has changed; refresh and retry.", 409);
    }

    const manager = canManageWorkItems(membership.role);
    const assignee = item.assigneeId === user.id;

    if (!manager && !assignee) {
      return fail("You cannot update this work item.", 403);
    }

    const update: {
      title?: string;
      description?: string;
      type?: WorkItemType;
      priority?: Priority;
      status?: WorkItemStatus;
      dueDate?: Date | null;
      assigneeId?: string | null;
      version: { increment: number };
    } = { version: { increment: 1 } };

    const changedFields: string[] = [];

    if ("title" in data) {
      if (
        typeof data.title !== "string" ||
        !data.title.trim() ||
        data.title.trim().length > 200
      ) {
        return fail("Title must be 1–200 characters.", 400);
      }
      update.title = data.title.trim();
      changedFields.push("title");
    }

    if ("description" in data) {
      if (typeof data.description !== "string") {
        return fail("Description must be a string.", 400);
      }
      update.description = data.description;
      changedFields.push("description");
    }

    if ("type" in data) {
      if (typeof data.type !== "string" || !types.has(data.type)) {
        return fail("Invalid work item type.", 400);
      }
      update.type = data.type as WorkItemType;
      changedFields.push("type");
    }

    if ("priority" in data) {
      if (
        typeof data.priority !== "string" ||
        !priorities.has(data.priority)
      ) {
        return fail("Invalid priority.", 400);
      }
      update.priority = data.priority as Priority;
      changedFields.push("priority");
    }

    if ("status" in data) {
      if (typeof data.status !== "string" || !statuses.has(data.status)) {
        return fail("Invalid status.", 400);
      }

      const nextStatus = data.status as WorkItemStatus;

      if (
        nextStatus !== item.status &&
        !transitions[item.status].includes(nextStatus)
      ) {
        return fail(
          `Transition from ${item.status} to ${nextStatus} is not allowed.`,
          409,
        );
      }

      if (
        nextStatus === WorkItemStatus.CLOSED &&
        membership.role !== TeamRole.ADMIN &&
        membership.role !== TeamRole.LEAD
      ) {
        return fail("Only leads or admins can close work items.", 403);
      }

      update.status = nextStatus;
      changedFields.push("status");
    }

    if ("dueDate" in data) {
      if (data.dueDate === null) {
        update.dueDate = null;
      } else if (typeof data.dueDate === "string") {
        const date = new Date(data.dueDate);
        if (Number.isNaN(date.getTime())) {
          return fail("Invalid due date.", 400);
        }
        update.dueDate = date;
      } else {
        return fail("Due date must be a date string or null.", 400);
      }
      changedFields.push("dueDate");
    }

    if ("assigneeId" in data) {
      if (!manager) {
        return fail("Only leads or admins can reassign items.", 403);
      }

      if (
        data.assigneeId !== null &&
        typeof data.assigneeId !== "string"
      ) {
        return fail("Assignee ID must be a string or null.", 400);
      }

      if (typeof data.assigneeId === "string") {
        const target = await getTeamMembership(
          data.assigneeId,
          item.teamId,
        );
        if (!target) {
          return fail("Assignee must belong to this team.", 400);
        }
      }

      update.assigneeId = data.assigneeId as string | null;
      changedFields.push("assigneeId");
    }

    if (changedFields.length === 0) {
      return fail("No fields to update.", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.workItem.updateMany({
        where: {
          id: item.id,
          teamId: item.teamId,
          version: item.version,
        },
        data: update,
      });

      if (result.count !== 1) return null;

      const saved = await tx.workItem.findUniqueOrThrow({
        where: { id: item.id },
      });

      await tx.activityEvent.create({
        data: {
          workItemId: item.id,
          actorId: user.id,
          action: "WORK_ITEM_UPDATED",
          details: {
            changedFields,
            previousVersion: item.version,
            newVersion: item.version + 1,
          },
        },
      });

      return saved;
    });

    if (!updated) {
      return fail("Work item has changed; refresh and retry.", 409);
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    unstable_rethrow(error);
    console.error("PATCH work item failed:", error);
    return fail("Unable to update work item.", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Authentication required.", 401);

    const { id } = await params;
    const { item, membership } = await findItem(id, user.id);

    if (!item) return fail("Work item not found.", 404);
    if (!membership) {
      return fail("You do not have access to this team.", 403);
    }
    if (!canManageWorkItems(membership.role)) {
      return fail("Only leads or admins can delete work items.", 403);
    }

    try {
      const deleted = await prisma.$transaction(async (tx) => {
        const result = await tx.workItem.deleteMany({
          where: {
            id: item.id,
            teamId: item.teamId,
            version: item.version,
          },
        });
        return result.count === 1;
      });

      if (!deleted) {
        return fail("Work item has changed; refresh and retry.", 409);
      }

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      // ActivityEvent uses onDelete: Restrict in the current schema.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        return fail(
          "This work item has activity history and cannot be deleted.",
          409,
        );
      }
      throw error;
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("DELETE work item failed:", error);
    return fail("Unable to delete work item.", 500);
  }
}
