"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

/**
 * Quiet acknowledgment.
 *
 * No confetti. No streak counter. No "Great job!"
 * Auto-dismiss to home after 4 seconds if no interaction.
 *
 * If the check-in raised a flag, the coordinator gets notified within seconds.
 * The veteran does not see "you've been flagged."
 */
export default function CheckInDone() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push("/v"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Check className="h-8 w-8 text-ink-secondary" aria-hidden />
      <h1 className="mt-6 text-display font-semibold text-ink-primary">Got it.</h1>
      <p className="mt-3 text-body-lg text-ink-secondary">Talk to you next week.</p>
      <Link
        href="/v/trends"
        className="mt-10 text-body text-primary underline-offset-4 hover:underline"
      >
        See your trends
      </Link>
    </div>
  );
}
