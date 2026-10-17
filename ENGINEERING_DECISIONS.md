# Engineering Decisions — Newtonite Ops

## 1. Technology Stack

Newtonite Ops uses Next.js App Router, TypeScript, PostgreSQL, Prisma, Auth.js, and Tailwind CSS.

**Rationale:** This stack provides typed application code, relational data storage, authentication, and server-side API routes within one application.

## 2. Authentication

The application uses the Auth.js credentials provider. User passwords are checked using bcrypt-compatible password hashing.

Protected API routes obtain the current user from the authenticated session.

**Decision:** Authentication is enforced at the API boundary rather than relying on the UI to hide protected operations.

## 3. Team-Based Authorization

Work items belong to teams. A user must have membership in the relevant team to access its work items.

Operations also enforce role-based permissions. For example, Viewer users cannot claim work items, and management operations require appropriate permissions.

**Rationale:** Authentication establishes who the user is; authorization determines which team resources and actions they may access.

## 4. Atomic Work-Item Claims

The claim endpoint uses a conditional database update. The update requires the work item to remain open, unassigned, and at the version observed by the request.

The update also assigns the item, changes its status to `IN_PROGRESS`, and increments its version.

**Rationale:** Concurrent requests must not both successfully claim the same work item.

**Verified behavior:** Two simultaneous HTTP claim requests produced one `200` response and one `409` response.

## 5. Optimistic Concurrency

Work items contain a version number. Updates use the expected version as part of the database update condition and increment the version after a successful update.

A stale update is rejected with a conflict response instead of silently overwriting a newer change.

**Rationale:** This protects against lost updates when multiple users modify the same work item.

## 6. Activity Logging

Successful claim operations create a `WORK_ITEM_CLAIMED` activity event in the same database transaction as the work-item update. Work-item updates also record activity events.

The claim event records the actor and relevant previous and new values, including status, assignee, and version.

**Rationale:** Keeping the event in the transaction ensures that a successful claim and its audit record are committed together.

**Verified behavior:** The HTTP concurrency test produced exactly one successful claim activity event.

## 7. Workflow Validation

The work-item update endpoint validates requested status transitions and applies role restrictions to management-sensitive transitions.

**Rationale:** Explicit transition rules prevent arbitrary status changes that violate the application's workflow.

## 8. Deletion and Activity History

The delete endpoint handles cases where related activity history prevents deleting a work item.

**Rationale:** Historical activity records should not be silently discarded when database relationships restrict deletion.

## 9. Error Responses

Protected API routes return appropriate HTTP status codes for authentication failures, authorization failures, missing resources, validation errors, and concurrency conflicts.

Observed examples include:
- `401` — Authentication required.
- `403` — Team access or role permission denied.
- `404` — Work item not found.
- `409` — Concurrent modification or claim conflict.
- `200` — Successful retrieval or update.

## 10. Verification Approach

Development verification has included:
- ESLint with no warnings.
- A successful production build.
- A database-level conditional-update concurrency script.
- Concurrent HTTP claim requests.
- Verification of claim activity records.
- Unauthenticated API access.
- Same-team and cross-team access checks.
- Viewer-role claim restriction and confirmation that the rejected attempt did not modify the item.

These checks are manual development verification and utility-script testing. They do not imply that a comprehensive automated API integration-test suite exists.

## 11. Known Limitations

- Full automated API integration coverage remains to be established.
- The database-level concurrency script is separate from the HTTP endpoint test.
- Demo credentials and environment settings must be reviewed before deployment.
- Production deployment requires appropriate secret management, database configuration, and operational security review.
