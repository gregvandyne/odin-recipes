import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";

interface Props {
  body: string;
  sentAt: Date;
  fromSelf: boolean;
  read?: boolean;
  aiAssisted?: boolean;
}

/**
 * Single message bubble. iMessage-inspired but quieter — no chrome, no
 * gradients. Veteran's bubbles align right, the other party's left.
 *
 * Read receipts are subtle. Typing indicators intentionally absent
 * (per design spec: "Typing indicators: NO. Adds anxiety, adds noise").
 */
export function MessageBubble({ body, sentAt, fromSelf, read, aiAssisted }: Props) {
  return (
    <div className={cn("flex flex-col", fromSelf ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body shadow-soft",
          fromSelf
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-canvas-banded text-ink-primary rounded-bl-sm",
        )}
      >
        {body}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-caption text-ink-tertiary">
        {aiAssisted && (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" aria-hidden /> AI-assisted draft
          </span>
        )}
        <time dateTime={sentAt.toISOString()}>{format(sentAt, "h:mm a")}</time>
        {fromSelf && read && <span>· Read</span>}
      </div>
    </div>
  );
}
