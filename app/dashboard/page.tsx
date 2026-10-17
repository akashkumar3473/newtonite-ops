
import { redirect } from "next/navigation";
import { auth, signOut } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { WorkItemStatus } from "@/app/generated/prisma/client";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        select: {
          teamId: true,
          role: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const teamIds = user.memberships.map(
    (membership) => membership.teamId,
  );

  const [
    openCount,
    inProgressCount,
    awaitingApprovalCount,
  ] = await Promise.all([
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        status: WorkItemStatus.OPEN,
      },
    }),
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        status: WorkItemStatus.IN_PROGRESS,
      },
    }),
    prisma.workItem.count({
      where: {
        teamId: { in: teamIds },
        status: WorkItemStatus.AWAITING_APPROVAL,
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              Newtonite Ops
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Operations Dashboard
            </h1>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Welcome, {user.name}
          </h2>
          <p className="mt-2 text-slate-400">{user.email}</p>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-300">
              Your teams
            </h3>

            {user.memberships.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">
                You are not currently a member of any team.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {user.memberships.map((membership) => (
                  <li
                    key={membership.teamId}
                    className="rounded-full border border-slate-700 px-3 py-1 text-sm"
                  >
                    {membership.team.name} · {membership.role}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Open work items",
              value: openCount,
            },
            {
              label: "In progress",
              value: inProgressCount,
            },
            {
              label: "Awaiting approval",
              value: awaitingApprovalCount,
            },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-bold">
                {item.value}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
