import { describe, it, expect, vi } from "vitest";
import { ensureMessageThread } from "../ensure-thread";

/**
 * Build a minimal Prisma transaction-client stub that satisfies the
 * ensureMessageThread call shape. The helper only touches `messageThread`,
 * so we mock just that.
 */
function buildTx({
  existing,
  created,
}: {
  existing: { id: string } | null;
  created: { id: string };
}) {
  const findFirst = vi.fn().mockResolvedValue(existing);
  const create = vi.fn().mockResolvedValue(created);
  return {
    tx: { messageThread: { findFirst, create } } as unknown as Parameters<
      typeof ensureMessageThread
    >[0],
    findFirst,
    create,
  };
}

describe("ensureMessageThread", () => {
  it("returns the existing thread without creating a new one", async () => {
    const { tx, findFirst, create } = buildTx({
      existing: { id: "thread-existing" },
      created: { id: "should-not-be-used" },
    });
    const result = await ensureMessageThread(tx, "org-1", "vet-1", "coord-1");
    expect(result).toEqual({ id: "thread-existing", isNew: false });
    expect(findFirst).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new thread when none exists", async () => {
    const { tx, findFirst, create } = buildTx({
      existing: null,
      created: { id: "thread-new" },
    });
    const result = await ensureMessageThread(tx, "org-1", "vet-1", "coord-1");
    expect(result).toEqual({ id: "thread-new", isNew: true });
    expect(findFirst).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    // Confirm the create call carries the right tenant + participants.
    const arg = create.mock.calls[0]![0];
    expect(arg.data).toMatchObject({
      organizationId: "org-1",
      veteranId: "vet-1",
      coordinatorId: "coord-1",
      status: "ACTIVE",
    });
  });

  it("filters archived threads when looking for an existing one", async () => {
    const { tx, findFirst } = buildTx({
      existing: null,
      created: { id: "thread-new" },
    });
    await ensureMessageThread(tx, "org-1", "vet-1", "coord-1");
    const where = findFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      organizationId: "org-1",
      veteranId: "vet-1",
      coordinatorId: "coord-1",
      status: { not: "ARCHIVED" },
    });
  });
});
