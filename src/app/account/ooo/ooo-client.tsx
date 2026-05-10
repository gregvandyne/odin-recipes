"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldHelpText, Input, Textarea, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

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

const DEFAULT_REPLY =
  "Out of office. For urgent issues, please contact your coverage coordinator.";

export function OooClient({ initial, peers }: { initial: Block[]; peers: Peer[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [coverage, setCoverage] = useState<string>("");
  const [reply, setReply] = useState(DEFAULT_REPLY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ start?: string; end?: string }>({});

  function validate(): boolean {
    const e: typeof errors = {};
    if (!start) e.start = "Pick when your OOO starts.";
    if (!end) e.end = "Pick when your OOO ends.";
    if (start && end && new Date(end) <= new Date(start)) e.end = "End must be after start.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function add() {
    if (!validate()) return;
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
        toast.success("OOO block added.");
        setStart("");
        setEnd("");
      } else {
        toast.error("Couldn't save — try again.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Cancel this OOO block?",
      body: "Flags during this window will route to you again.",
      confirmLabel: "Cancel block",
      tone: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ooo?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setBlocks(blocks.filter((b) => b.id !== id));
        toast.success("OOO cancelled.");
      } else {
        toast.error("Couldn't cancel — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {blocks.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="h-5 w-5" aria-hidden />}
          title="No OOO scheduled"
          description="Add a block below. While it's active, new flags will route to your coverage."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-canvas-card">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-body">
                <div className="text-ink-primary">
                  {new Date(b.startAt).toLocaleString()}{" "}
                  <span className="text-ink-tertiary">→</span>{" "}
                  {new Date(b.endAt).toLocaleString()}
                </div>
                <div className="text-caption text-ink-tertiary">
                  {b.coverageCoordinatorId
                    ? `Coverage: ${peers.find((p) => p.id === b.coverageCoordinatorId)?.name ?? "set"}`
                    : "No coverage — flags route to PM"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(b.id)} disabled={busy}>
                Cancel
              </Button>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-canvas-card p-5">
        <h2 className="flex items-center gap-2 text-body-lg font-semibold text-ink-primary">
          <Plus className="h-4 w-4 text-ink-secondary" aria-hidden /> Add a block
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Start</FieldLabel>
            <Input
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (errors.start) setErrors((er) => ({ ...er, start: undefined }));
              }}
            />
            {errors.start && (
              <p className="text-caption font-semibold text-crisis" role="alert">
                {errors.start}
              </p>
            )}
          </Field>
          <Field>
            <FieldLabel>End</FieldLabel>
            <Input
              type="datetime-local"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                if (errors.end) setErrors((er) => ({ ...er, end: undefined }));
              }}
            />
            {errors.end && (
              <p className="text-caption font-semibold text-crisis" role="alert">
                {errors.end}
              </p>
            )}
          </Field>
        </div>
        <Field>
          <FieldLabel optional>Coverage</FieldLabel>
          <Select value={coverage} onChange={(e) => setCoverage(e.target.value)}>
            <option value="">— route to PM if no one is set —</option>
            {peers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <FieldHelpText>
            New flags during this block route here automatically. Veterans messaging you will see your auto-reply.
          </FieldHelpText>
        </Field>
        <Field>
          <FieldLabel>Auto-reply</FieldLabel>
          <Textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={add} disabled={busy}>
            {busy ? "Saving…" : "Add block"}
          </Button>
        </div>
      </section>
    </div>
  );
}
