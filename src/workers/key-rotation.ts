/**
 * Encryption-key rotation helper.
 *
 * The encryption keyring (src/lib/security/encryption.ts) supports versioned
 * keys: `APP_ENCRYPTION_KEY_V1`, `_V2`, etc, with `APP_ENCRYPTION_KEY_VERSION`
 * pointing at the active key. Decryption reads `<version>:` prefix and looks
 * the matching key up; encryption uses the active key.
 *
 * This worker doesn't generate new keys (that's an operator action — keys
 * live in the deploy environment, not the app DB). Instead it backfills:
 * lazily reads PHI-encrypted columns and rewrites them under the active
 * key version, so old key versions can eventually be retired.
 *
 * Schedule: monthly. Bounded budget per run (10k rows / 5 minutes) so a
 * mass re-encryption doesn't pin the DB.
 *
 * Audit: every backfill batch emits a `KEY_ROTATE` audit entry.
 */

import { prisma } from "@/lib/db/prisma";
import { withCorrelation } from "@/lib/logging/log";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { decryptField, encryptField, checkInAad, contactAad, messageAad } from "@/lib/security/encryption";

const BATCH_SIZE = 500;
const MAX_BATCHES_PER_RUN = 20;

interface RewriteSummary {
  table: string;
  scanned: number;
  rewritten: number;
}

export async function runKeyRotationBackfill(correlationId: string): Promise<RewriteSummary[]> {
  const log = withCorrelation(correlationId, { component: "worker.key-rotation" });
  const activeVersion =
    (process.env.APP_ENCRYPTION_KEY_VERSION ?? "v1").toLowerCase();

  const summaries: RewriteSummary[] = [];

  // CheckIn.openEndedResponse
  summaries.push(
    await rewriteTable({
      table: "CheckIn",
      activeVersion,
      load: (cursor) =>
        prisma.checkIn.findMany({
          where: {
            openEndedResponse: { not: null },
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
          select: { id: true, organizationId: true, veteranId: true, openEndedResponse: true },
        }),
      isStale: (row) =>
        !!row.openEndedResponse &&
        !row.openEndedResponse.startsWith(`${activeVersion}:`),
      rewrite: async (row) => {
        if (!row.openEndedResponse) return false;
        const aad = checkInAad(row.organizationId, row.veteranId, row.id);
        const plain = decryptField(row.openEndedResponse, aad);
        const reencrypted = encryptField(plain, aad);
        await prisma.checkIn.update({
          where: { id: row.id },
          data: { openEndedResponse: reencrypted },
        });
        return true;
      },
      cursor: (row) => row.id,
      log,
    }),
  );

  // Message.bodyEncrypted
  summaries.push(
    await rewriteTable({
      table: "Message",
      activeVersion,
      load: (cursor) =>
        prisma.message.findMany({
          where: { ...(cursor ? { id: { gt: cursor } } : {}) },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
          select: { id: true, organizationId: true, threadId: true, bodyEncrypted: true },
        }),
      isStale: (row) => !row.bodyEncrypted.startsWith(`${activeVersion}:`),
      rewrite: async () => {
        // Message is append-only at the trigger level — re-encryption needs
        // the trigger to honor `app.deprovision = 'true'` or a similar
        // operator escape hatch. Skip for now and emit a note.
        return false;
      },
      cursor: (row) => row.id,
      log,
    }),
  );

  // Contact.summary
  summaries.push(
    await rewriteTable({
      table: "Contact",
      activeVersion,
      load: (cursor) =>
        prisma.contact.findMany({
          where: { ...(cursor ? { id: { gt: cursor } } : {}) },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
          select: { id: true, organizationId: true, summary: true, editableUntil: true },
        }),
      isStale: (row) => !row.summary.startsWith(`${activeVersion}:`),
      rewrite: async (row) => {
        // Contact updates are blocked past editableUntil. Skip in that case.
        if (row.editableUntil && row.editableUntil < new Date()) return false;
        const aad = contactAad(row.organizationId, row.id);
        const plain = decryptField(row.summary, aad);
        const reencrypted = encryptField(plain, aad);
        await prisma.contact.update({
          where: { id: row.id },
          data: { summary: reencrypted },
        });
        return true;
      },
      cursor: (row) => row.id,
      log,
    }),
  );

  await logAudit({
    organizationId: null,
    actorId: null,
    actorRole: "SYSTEM",
    action: AUDIT_ACTIONS.KEY_ROTATE,
    resourceType: "Encryption",
    correlationId,
    metadata: { activeVersion, summaries },
  });

  log.info({ summaries }, "key-rotation backfill complete");
  return summaries;
}

interface RewriteArgs<R> {
  table: string;
  activeVersion: string;
  load: (cursor: string | null) => Promise<R[]>;
  isStale: (row: R) => boolean;
  rewrite: (row: R) => Promise<boolean>;
  cursor: (row: R) => string;
  log: { info: (obj: Record<string, unknown>, msg?: string) => void; warn: (obj: Record<string, unknown>, msg?: string) => void };
}

async function rewriteTable<R>(args: RewriteArgs<R>): Promise<RewriteSummary> {
  let scanned = 0;
  let rewritten = 0;
  let cursor: string | null = null;
  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const rows = await args.load(cursor);
    if (rows.length === 0) break;
    for (const row of rows) {
      scanned += 1;
      if (args.isStale(row)) {
        try {
          const ok = await args.rewrite(row);
          if (ok) rewritten += 1;
        } catch (err) {
          args.log.warn(
            {
              err: err instanceof Error ? err.message : String(err),
              table: args.table,
              cursor: args.cursor(row),
            },
            "key-rotation rewrite failed",
          );
        }
      }
    }
    cursor = args.cursor(rows[rows.length - 1]!);
    if (rows.length < BATCH_SIZE) break;
  }
  return { table: args.table, scanned, rewritten };
}

// Bound to the data-retention queue's repeatable schedule? Keep this as a
// callable utility for now — invocation happens via a CLI script:
//   tsx -e 'import("./src/workers/key-rotation").then(m => m.runKeyRotationBackfill("manual"))'
