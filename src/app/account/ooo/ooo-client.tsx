"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Block {
  id: string;
  startAt: string;
  endAt: string;
  coverageCoordinatorId: string | null;
  autoReplyMessage: string;
}

interface Peer {
  id: string;
  name: string;
}

export function OooClient({ initial, peers }: { initial: Block[]; peers: Peer[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [coverage, setCoverage] = useState<string>("");
  const [reply, setReply] = useState(
    "Out of office. For urgent issues, please contact your coverage coordinator.",
  );
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/ooo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          coverageCoordinatorId: coverage || undefined,
          autoReplyMessage: reply,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        setBlocks([
          ...blocks,
          {
            id: j.id,
            startAt: new Date(start).toISOString(),
            endAt: new Date(end).toISOString(),
            coverageCoordinatorId: coverage || null,
            autoReplyMessage: reply,
          },
        ]);
        setStart("");
        setEnd("");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/ooo?id=${id}`, { method: "DELETE" });
      setBlocks(blocks.filter((b) => b.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-border rounded-lg border border-border bg-canvas-card">
        {blocks.length === 0 && (
          <li className="px-4 py-3 text-body text-ink-tertiary">No upcoming OOO.</li>
        )}
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center justify-between px-4 py-3 text-body">
            <div>
              <div className="text-ink-primary">
                {new Date(b.startAt).toLocaleString()} → {new Date(b.endAt).toLocaleString()}
              </div>
              <div className="text-caption text-ink-tertiary">
                {b.coverageCoordinatorId
                  ? `Coverage: ${peers.find((p) => p.id === b.coverageCoordinatorId)?.name ?? "set"}`
                  : "No coverage — flags route to PM"}
              </div>
            </div>
            <button onClick={() => remove(b.id)} disabled={busy} className="text-caption text-crisis hover:underline">
              Cancel
            </button>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
        <h2 className="text-body-lg font-semibold text-ink-primary">Add a block</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-caption text-ink-secondary">Start</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body" />
          </label>
          <label className="block">
            <span className="text-caption text-ink-secondary">End</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body" />
          </label>
        </div>
        <label className="block">
          <span className="text-caption text-ink-secondary">Coverage (optional)</span>
          <select value={coverage} onChange={(e) => setCoverage(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-canvas-card px-3 text-body">
            <option value="">— none —</option>
            {peers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-caption text-ink-secondary">Auto-reply (sent to veterans who message during the block)</span>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-border bg-canvas-card p-3 text-body" />
        </label>
        <button onClick={add} disabled={busy || !start || !end} className="h-11 rounded-md bg-primary px-4 text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          Add block
        </button>
      </div>
    </div>
  );
}
