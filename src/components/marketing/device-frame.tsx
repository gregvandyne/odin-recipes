/**
 * LaptopFrame + PhoneFrame — pure-CSS device mockups for marketing visuals.
 *
 * Reason these exist: dropping raw screenshots onto the landing page reads as
 * "embedded screenshot, not finished product." The thin chrome of a laptop or
 * phone bezel signals "this is the real product running on a real device" —
 * the same trick Stripe / Linear / Vercel use on their marketing pages.
 *
 * Both are decorative: aria-hidden, rendered as div + img (Next/Image).
 * Real screenshots are kept under /public/marketing/, recaptured from the
 * seed-screenshots dataset so the surface inside the frame matches reality.
 */

import Image from "next/image";

interface LaptopFrameProps {
  src: string;
  alt: string;
  /** Width hint passed to next/image. Aspect ratio fixed at 16:10. */
  width?: number;
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Optional caption shown below the device. */
  caption?: string;
  priority?: boolean;
}

export function LaptopFrame({
  src,
  alt,
  width = 1280,
  className,
  caption,
  priority = false,
}: LaptopFrameProps) {
  const height = Math.round((width * 10) / 16);
  return (
    <figure className={className} aria-hidden={!caption}>
      <div className="relative mx-auto" style={{ maxWidth: width }}>
        {/* Lid / screen */}
        <div className="rounded-[14px] border border-border bg-canvas-card p-2 shadow-raised ring-1 ring-black/5 dark:ring-white/10 sm:rounded-[18px] sm:p-2.5">
          <div className="overflow-hidden rounded-[8px] bg-canvas-banded sm:rounded-[10px]">
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              priority={priority}
              className="block h-auto w-full"
            />
          </div>
        </div>
        {/* Base / hinge — two trapezoids using clip-path */}
        <div
          aria-hidden
          className="mx-auto -mt-px h-3 w-[102%] rounded-b-md bg-canvas-banded ring-1 ring-border"
          style={{ clipPath: "polygon(2% 0, 98% 0, 100% 100%, 0 100%)" }}
        />
        <div
          aria-hidden
          className="mx-auto -mt-1 h-1 w-[40%] rounded-b bg-border-strong/40"
        />
      </div>
      {caption && (
        <figcaption className="mt-4 text-center text-caption text-ink-tertiary">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

interface PhoneFrameProps {
  src: string;
  alt: string;
  /** Width hint passed to next/image. Aspect ratio fixed at 9:19.5 (iPhone-like). */
  width?: number;
  className?: string;
  caption?: string;
  priority?: boolean;
}

export function PhoneFrame({
  src,
  alt,
  width = 280,
  className,
  caption,
  priority = false,
}: PhoneFrameProps) {
  const height = Math.round((width * 19.5) / 9);
  return (
    <figure className={className} aria-hidden={!caption}>
      <div className="relative mx-auto" style={{ maxWidth: width }}>
        <div className="rounded-[36px] border border-border bg-canvas-card p-2 shadow-raised ring-1 ring-black/5 dark:ring-white/10">
          <div className="relative overflow-hidden rounded-[28px] bg-canvas-banded">
            {/* Speaker notch */}
            <div
              aria-hidden
              className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black/85"
            />
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              priority={priority}
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-caption text-ink-tertiary">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
