"use client";

import { useEffect, useRef } from "react";
import { numberFormat } from "@/lib/format";

/**
 * A number that counts up to its value once, on arrival. The server renders the
 * final value, so crawlers, no-JS visitors and reduced-motion users just see it.
 */
export function CountUp({ value, duration = 1600 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value < 10 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = numberFormat.format(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {numberFormat.format(value)}
    </span>
  );
}
