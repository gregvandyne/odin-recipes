"use client";

/**
 * Marketing motion primitives — `Reveal` for in-viewport fade-up,
 * `CountUp` for stat figures animating from a low number.
 *
 * Both honor prefers-reduced-motion at the OS level (Framer Motion does
 * this automatically) and degrade gracefully to a no-op static render.
 */

import { motion, useReducedMotion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Custom className applied to the motion wrapper. */
  className?: string;
  /** Negative margin trigger — fires before the element is fully in view. */
  rootMargin?: string;
}

export function Reveal({ children, delay = 0, className, rootMargin = "-80px" }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      // data-reveal lets a CSS rule force the final state when
      // prefers-reduced-motion is set — bypasses motion's lifecycle entirely
      // so screenshots + reduced-motion users see content immediately.
      data-reveal
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: rootMargin }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.7, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

interface CountUpProps {
  /** Numeric value to count to. Non-numeric prefix/suffix is split out automatically. */
  value: string;
  /** Duration in seconds. */
  duration?: number;
  className?: string;
}

/**
 * Counts up from a low number to the final value when scrolled into view.
 * Handles common formats: "17.6", "44–72%", "200,000+", "~28 days".
 * For complex strings it falls back to a static render.
 */
export function CountUp({ value, duration = 1.4, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);

  // Parse the first decimal/integer number in the string. Used to drive the
  // tween; non-numeric parts are preserved literally.
  const match = value.match(/^([^\d-]*)(-?\d+(?:[.,]\d+)?)(.*)$/);

  useEffect(() => {
    if (!inView || reduce || !match) {
      setDisplay(value);
      return;
    }
    const prefix = match[1] ?? "";
    const numStr = match[2] ?? "0";
    const suffix = match[3] ?? "";
    const target = parseFloat(numStr.replace(/,/g, ""));
    const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min((performance.now() - startedAt) / (duration * 1000), 1);
      // Ease-out cubic — fast start, gentle settle.
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = target * eased;
      const formatted = decimals > 0
        ? cur.toFixed(decimals)
        : Math.round(cur).toLocaleString();
      setDisplay(`${prefix}${formatted}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value, duration, match]);

  return <span ref={ref} className={className}>{display}</span>;
}
