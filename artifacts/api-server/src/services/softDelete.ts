import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  organizationsTable,
  workspacesTable,
  deleteRequestsTable,
  auditLogTable,
} from "@workspace/db/schema";
import type { DeleteSubjectType } from "@workspace/db/schema";

interface SoftDeleteOptions {
  subjectType: DeleteSubjectType;
  subjectId: string;
  requestedBy: string;
  graceDays?: number;
  reason?: string;
}

interface SoftDeleteResult {
  requestId: string;
  confirmAfter: Date;
  purgeAfter: Date;
}

const DEFAULT_GRACE_DAYS = 30;
const CONFIRM_AFTER_HOURS = 24;

/**
 * Schedule a soft-delete for a user, org, or workspace.
 * Sets deleted_at on the subject row and creates a delete_requests record.
 * All writes happen in a single transaction.
 */
export async function scheduleSoftDelete(
  opts: SoftDeleteOptions
): Promise<SoftDeleteResult> {
  const { subjectType, subjectId, requestedBy, reason } = opts;
  const graceDays = opts.graceDays ?? DEFAULT_GRACE_DAYS;

  const now = new Date();
  const confirmAfter = new Date(now.getTime() + CONFIRM_AFTER_HOURS * 60 * 60 * 1000);
  const purgeAfter = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
  const requestId = `dr_${randomUUID()}`;

  await db.transaction(async (tx) => {
    // Mark the subject row as soft-deleted
    if (subjectType === "user") {
      await tx
        .update(usersTable)
        .set({ deletedAt: now, purgeAfter })
        .where(eq(usersTable.id, subjectId));
    } else if (subjectType === "org") {
      await tx
        .update(organizationsTable)
        .set({ deletedAt: now, purgeAfter })
        .where(eq(organizationsTable.id, subjectId));
    } else {
      await tx
        .update(workspacesTable)
        .set({ deletedAt: now, purgeAfter })
        .where(eq(workspacesTable.id, subjectId));
    }

    // Create the deletion request record
    await tx.insert(deleteRequestsTable).values({
      id: requestId,
      subjectType,
      subjectId,
      requestedBy,
      requestedAt: now,
      confirmAfter,
      purgeAfter,
      state: "pending",
      reason: reason ?? null,
      createdAt: now,
      updatedAt: now,
    });

    // Audit trail
    await tx.insert(auditLogTable).values({
      orgId: subjectType === "org" ? subjectId : null,
      userId: requestedBy,
      action: `${subjectType}.delete_scheduled`,
      metadata: { subjectType, subjectId, purgeAfter: purgeAfter.toISOString(), reason },
      createdAt: now,
    });
  });

  return { requestId, confirmAfter, purgeAfter };
}

/**
 * Cancel a pending soft-delete during the grace period.
 * Clears deleted_at/purge_after on the subject row and updates the request state.
 */
export async function cancelSoftDelete(
  requestId: string,
  cancelledBy: string
): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(deleteRequestsTable)
      .where(
        and(
          eq(deleteRequestsTable.id, requestId),
          eq(deleteRequestsTable.state, "pending")
        )
      )
      .limit(1);

    if (!req) {
      throw new Error(`Delete request ${requestId} not found or already processed`);
    }

    if (req.purgeAfter < now) {
      throw new Error(`Grace period for request ${requestId} has expired`);
    }

    // Restore the subject row
    if (req.subjectType === "user") {
      await tx
        .update(usersTable)
        .set({ deletedAt: null, purgeAfter: null })
        .where(eq(usersTable.id, req.subjectId));
    } else if (req.subjectType === "org") {
      await tx
        .update(organizationsTable)
        .set({ deletedAt: null, purgeAfter: null })
        .where(eq(organizationsTable.id, req.subjectId));
    } else {
      await tx
        .update(workspacesTable)
        .set({ deletedAt: null, purgeAfter: null })
        .where(eq(workspacesTable.id, req.subjectId));
    }

    await tx
      .update(deleteRequestsTable)
      .set({ state: "cancelled", updatedAt: now })
      .where(eq(deleteRequestsTable.id, requestId));

    await tx.insert(auditLogTable).values({
      orgId: req.subjectType === "org" ? req.subjectId : null,
      userId: cancelledBy,
      action: `${req.subjectType}.delete_cancelled`,
      metadata: { requestId, subjectType: req.subjectType, subjectId: req.subjectId },
      createdAt: now,
    });
  });
}
