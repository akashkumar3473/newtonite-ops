
import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/permissions";
import {
  Priority,
  WorkItemStatus,
  WorkItemType,
} from "@/app/generated/prisma/client";

export const instant = false;

const allowedStatuses = new Set<string>(Object.values(WorkItemStatus));
const allowedPriorities = new Set<string>(Object.values(Priority));
const allowedTypes = new Set<string>(Object.values(WorkItemType));

function positiveInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { teamId: true },
    });

    const teamIds = memberships.map((membership) => membership.teamId);
    const searchParams = request.nextUrl.searchParams;

    const page = positiveInteger(searchParams.get("page"), 1);
    const limit = positiveInteger(searchParams.get("limit"), 10);

    if (page === null || limit === null || limit > 100) {
      return NextResponse.json(
        {
          error:
            "page must be positive; limit must be between 1 and 100.",
        },
        { status: 400 },
      );
    }

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const type = searchParams.get("type");
    const requestedTeamId = searchParams.get("teamId");
    const search = searchParams.get("search")?.trim();

    if (status && !allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "Invalid status." },
        { status: 400 },
      );
    }

    if (priority && !allowedPriorities.has(priority)) {
      return NextResponse.json(
        { error: "Invalid priority." },
        { status: 400 },
      );
    }

    if (type && !allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "Invalid work item type." },
        { status: 400 },
      );
    }

    if (requestedTeamId && !teamIds.includes(requestedTeamId)) {
      return NextResponse.json(
        { error: "You do not have access to this team." },
        { status: 403 },
      );
    }

    const where = {
      teamId: requestedTeamId
        ? { equals: requestedTeamId }
        : { in: teamIds },
      ...(status ? { status: status as WorkItemStatus } : {}),
      ...(priority ? { priority: priority as Priority } : {}),
      ...(type ? { type: type as WorkItemType } : {}),
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return NextResponse.json(
        { error: "Page number is too large." },
        { status: 400 },
      );
    }

    const [items, total] = await prisma.$transaction([
      prisma.workItem.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          priority: true,
          status: true,
          teamId: true,
          assigneeId: true,
          createdById: true,
          dueDate: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          team: { select: { name: true } },
          assignee: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.workItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    unstable_rethrow(error);

    console.error("GET /api/work-items failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve work items." },
      { status: 500 },
    );
  }
}
