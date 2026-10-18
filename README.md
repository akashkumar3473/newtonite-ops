# Newtonite Ops

Newtonite Ops is a team-based operations management application built with Next.js, TypeScript, PostgreSQL, Prisma, and Auth.js.

It supports authenticated work-item management, team-based authorization, concurrent claim protection, optimistic concurrency checks, workflow enforcement, and activity logging.

## Features

- Credentials-based authentication using Auth.js.
- Team membership and role-based access control.
- Work-item listing with filtering, search, and pagination.
- Work-item creation, detail retrieval, updates, and deletion.
- Work-item claiming with atomic database updates.
- Optimistic concurrency using work-item version numbers.
- Server-side workflow transition validation.
- Activity events for work-item claims and updates.
- Team and role checks for protected operations.

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
- A PostgreSQL database for Newtonite Ops.

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/newtonite_ops"
AUTH_SECRET="replace-with-a-strong-random-secret"
```

Replace the database username and password with your local PostgreSQL credentials. Set `AUTH_SECRET` to a strong, private random value.

Never commit `.env` or expose database credentials, authentication secrets, or session cookies.

The repository includes `.env.example` as a configuration template. Copy it to `.env` and update the values for your local environment.

## Installation and Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Configure `.env` and ensure PostgreSQL is running. Create the `newtonite_ops` database if it does not already exist.

### 3. Apply database migrations

```bash
npx prisma migrate deploy
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Seed demo data

For a fresh development database, run:

```bash
npm run seed
```

**Important:** The seed script uses upserts for teams, users, and memberships, but creates new work items on each run. Running it repeatedly can create duplicate work items. Use it once on a fresh development database unless you have reviewed and adjusted the seed behavior.

### 6. Start the development server

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

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production server after building. |
| `npm run seed` | Seed demo data into the database. |
| `npm run test:concurrent` | Run the database-level concurrent-claim test. |

The concurrency script tests conditional database updates. It is not a replacement for HTTP integration tests against the claim endpoint.

## Authentication and Demo Accounts

The application uses Auth.js credentials-based authentication.

The seed script creates the following demo accounts. All listed accounts use the password `DemoPass123!`.

| Role | Email |
|---|---|
| Admin | `user1@newtonite.local` |
| Lead | `user2@newtonite.local` |
| Member | `user3@newtonite.local` |
| Viewer | `user4@newtonite.local` |

Additional demo accounts follow the `userN@newtonite.local` naming pattern.

The seed script assigns users to teams and assigns roles cyclically. The accounts above reflect the role assignment in the current seed implementation.

**Security note:** These credentials are for local evaluation only. Do not use demo credentials in a shared or production environment.

## Work-Item API

All protected endpoints require authentication and enforce applicable team and role permissions.

### List work items

```http
GET /api/work-items
```

Supports query-based filtering, search, and pagination according to the route implementation.

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
- Work-item status transitions are validated on the server.
- Management permissions are required for restricted operations such as deletion and closing work items.

## Verification

The following checks have been run during development:

- ESLint completed without warnings.
- The production build completed successfully.
- Prisma schema validation completed successfully.
- Prisma Client generation completed successfully.
- Prisma migration status confirmed that the database schema was up to date.
- `prisma migrate deploy` completed with no pending migrations.
- Database-level concurrent claim testing produced exactly one winner.
- Two simultaneous HTTP claim requests returned one success (`200`) and one conflict (`409`).
- The successful claim created exactly one `WORK_ITEM_CLAIMED` activity event.
- Unauthenticated API access returned `401`.
- Same-team access returned `200`.
- Cross-team access returned `403`.
- A Compliance Viewer claim attempt returned `403` and left the item unchanged.
- A stale update was rejected with `409` during manual development verification.

These are development verification results. They do not imply that a comprehensive automated API integration-test suite is configured. The automated concurrency script is database-level; the HTTP endpoint checks were performed separately.

## Known Limitations

- Full automated coverage of API routes and authorization combinations remains to be established.
- Idempotency-key handling for repeated requests has not been implemented.
- A transactional outbox with a retrying background worker has not been implemented.
- The seed script can create duplicate work items when rerun.
- The concurrency script and HTTP endpoint checks are separate tests.
- The documented setup uses a locally configured PostgreSQL database; a complete Docker Compose setup is not currently documented here.
- Review environment configuration, demo credentials, database migrations, and operational security before production deployment.

## Engineering Decisions

See [ENGINEERING_DECISIONS.md](./ENGINEERING_DECISIONS.md) for details about authorization, concurrency control, and activity logging.
