
# Newtonite Ops

Newtonite Ops is a team-based operations management application built with Next.js, TypeScript, PostgreSQL, Prisma, and Auth.js.

It supports authenticated work-item management, team-based authorization, concurrent claim protection, optimistic concurrency checks, and activity logging.

## Features

- Credentials-based authentication.
- Team membership and role-based access control.
- Work-item listing with filtering, search, and pagination.
- Work-item detail retrieval and updates.
- Work-item claiming with atomic database updates.
- Optimistic concurrency using work-item version numbers.
- Activity events for work-item claims and updates.
- Role and team checks for protected operations.

## Technology Stack

- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma ORM
- Auth.js / NextAuth credentials provider
- Tailwind CSS
- bcryptjs

## Project Structure

- `app/` — Application pages and API route handlers.
- `app/login/` — Login page.
- `app/dashboard/` — Operations dashboard.
- `app/api/auth/[...nextauth]/` — Authentication handlers.
- `app/api/work-items/` — Work-item listing and creation endpoint.
- `app/api/work-items/[id]/` — Work-item detail, update, and deletion endpoint.
- `app/api/work-items/[id]/claim/` — Work-item claim endpoint.
- `src/lib/` — Shared Prisma, authentication, and permission utilities.
- `prisma/` — Prisma schema, migrations, and seed script.
- `scripts/` — Database utilities and concurrency-test scripts.

## Prerequisites

Install the following before running the application:

- Node.js compatible with the project dependencies.
- npm.
- PostgreSQL.
- A database created for Newtonite Ops.

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/newtonite_ops"
AUTH_SECRET="replace-with-a-strong-random-secret"
```

Replace the database username and password with your local PostgreSQL credentials. Configure `AUTH_SECRET` with a strong, private random value.

Never commit `.env` or expose database credentials, authentication secrets, or session cookies.

## Installation and Setup

Install dependencies:

```bash
npm install
```

Configure `.env` and ensure PostgreSQL is running.

Apply the existing Prisma migrations using the project's configured Prisma setup:

```bash
npx prisma migrate deploy
```

Generate the Prisma client if required by the project setup:

```bash
npx prisma generate
```

For a fresh development database, seed demo data:

```bash
npm run seed
```

**Warning:** Run the seed script only when appropriate for your database. Inspect `prisma/seed.ts` first because rerunning a seed script may create duplicate records if it does not use idempotent upserts.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
npm run seed
npm run test:concurrent
```

- `npm run dev` — Start the development server.
- `npm run lint` — Run ESLint.
- `npm run build` — Create a production build.
- `npm run start` — Start the production server after building.
- `npm run seed` — Run the database seed script.
- `npm run test:concurrent` — Run the database-level concurrent-claim test.

The concurrency script tests conditional database updates. It is not a replacement for HTTP integration tests against the claim endpoint.

## Authentication

The application uses the configured Auth.js credentials provider.

Demo accounts are created by the seed script. Check `prisma/seed.ts` for the configured demo email pattern and password. Change demo credentials before deploying to any shared or production environment.

## Work-Item API

### List work items

```http
GET /api/work-items
```

Supports query-based filtering, search, and pagination according to the route implementation. Authentication is required.

### Create a work item

```http
POST /api/work-items
```

Requires authentication and appropriate team permissions.

### Get a work item

```http
GET /api/work-items/:id
```

Returns the item to an authorized team member.

### Update a work item

```http
PATCH /api/work-items/:id
```

Requires a valid request body and the current item version. Updates use optimistic concurrency checks. Permissions and allowed status transitions are enforced by the route.

### Delete a work item

```http
DELETE /api/work-items/:id
```

Requires management permissions. Deletion may be rejected when related activity history prevents it.

### Claim a work item

```http
POST /api/work-items/:id/claim
```

Claims an eligible open, unassigned work item for the authenticated user. The route validates team membership and role permissions, uses a conditional atomic update, increments the version, and records a claim activity event.

## Authorization and Concurrency

- Users must be authenticated for protected endpoints.
- Access to work items is restricted by team membership.
- Viewer-role users cannot claim work items.
- Concurrent claim requests are protected by a conditional database update.
- Version checks prevent stale updates from silently overwriting newer changes.
- Claim and update operations record activity events.

## Verification

The following checks have been run during development:

- ESLint completed without warnings.
- The production build completed successfully.
- Database-level concurrent claim testing produced exactly one winner.
- Two simultaneous HTTP claim requests returned one success (`200`) and one conflict (`409`).
- The successful claim created exactly one `WORK_ITEM_CLAIMED` activity event.
- Unauthenticated API access returned `401`.
- Same-team access returned `200`.
- Cross-team access returned `403`.
- A Compliance Viewer claim attempt returned `403` and left the item unchanged.

These are development verification results, not a claim that a comprehensive automated integration-test suite is configured.

## Known Limitations

- The database concurrency script and HTTP endpoint checks are separate tests.
- Full automated coverage of all API routes and authorization combinations remains to be established.
- Review environment configuration, demo credentials, database migrations, and operational security before production deployment.

## Engineering Decisions

See [ENGINEERING_DECISIONS.md](./ENGINEERING_DECISIONS.md) for details about authorization, concurrency control, and activity logging.
