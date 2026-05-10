/**
 * Audit log export to NDJSON.
 *
 * GET /api/admin/audit/export?from=ISO&to=ISO&action=...&actorId=...
 *
 * Streams matching rows as newline-delimited JSON. Sensitive — requires
 * fresh MFA. Logs the export itself via `AUDIT_EXPORT`.
 *
 * Pagination: server-side keyset by (timestamp, id) with chunks of 1000.
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import type { AuditLog } from "@prisma/client";

const CHUNK_SIZE = 1000;

export const GET = withAuth(
  async (req: NextRequest, ctx) => {
    if (!ctx.organizationId) return new Response("no tenant", { status: 403 });
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const action = url.searchParams.get("action") ?? undefined;
    const actorId = url.searchParams.get("actorId") ?? undefined;

    const where = {
      organizationId: ctx.organizationId,
      timestamp: {
        gte: from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000),
        lte: to ? new Date(to) : new Date(),
      },
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
    };

    await logAudit({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: AUDIT_ACTIONS.AUDIT_EXPORT,
      resourceType: "AuditLog",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      metadata: { from, to, action, actorId },
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let cursorTs: Date | null = null;
        let cursorId: string | null = null;
        // Stream in chunks ordered by (timestamp ASC, id ASC).
        while (true) {
          const rows: AuditLog[] = await prisma.auditLog.findMany({
            where: cursorTs && cursorId
              ? { ...where, OR: [
                  { timestamp: { gt: cursorTs } },
                  { timestamp: cursorTs, id: { gt: cursorId } },
                ] }
              : where,
            orderBy: [{ timestamp: "asc" }, { id: "asc" }],
            take: CHUNK_SIZE,
          });
          if (rows.length === 0) break;
          for (const row of rows) {
            controller.enqueue(encoder.encode(JSON.stringify(row) + "\n"));
          }
          const last = rows[rows.length - 1]!;
          cursorTs = last.timestamp;
          cursorId = last.id;
          if (rows.length < CHUNK_SIZE) break;
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-${Date.now()}.ndjson"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
  { roles: ["PROGRAM_MANAGER", "SUPER_ADMIN"], rateLimit: "auth.password", requireMfa: true },
);
