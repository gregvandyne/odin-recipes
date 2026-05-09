import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Two-letter initials, e.g. "JR". */
  initials: string;
  /** Optional remote image. Falls back to initials on error. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "h-7 w-7 text-caption", md: "h-9 w-9 text-body", lg: "h-12 w-12 text-body-lg" };

/**
 * Avatar with deterministic background color derived from initials.
 * No clinical-blue palette; muted earth tones aligned with the design system.
 */
const TONES = [
  "bg-[#E5DDD0] text-[#5C4F3D]", // sand
  "bg-[#D8DCD2] text-[#3F4A36]", // sage
  "bg-[#D6DEE6] text-[#2F4A68]", // slate
  "bg-[#E5D5D2] text-[#6E3D38]", // clay
  "bg-[#DEDEDA] text-[#3A3A37]", // stone
];

function toneFor(initials: string): string {
  let hash = 0;
  for (const ch of initials) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length]!;
}

export function Avatar({ initials, src, size = "md", className, ...props }: AvatarProps) {
  const tone = toneFor(initials);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZES[size],
        tone,
        className,
      )}
      aria-hidden
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        initials.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
