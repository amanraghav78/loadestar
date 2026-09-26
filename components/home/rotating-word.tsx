"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * One word of the headline that keeps changing ("Backend", "Design", …), in
 * holographic foil. Decorative: the page's real <h1> carries the plain tagline.
 *
 * The server renders the first word in flow, so the line has its natural width
 * before any script runs. Once mounted, every word is measured and the slot's
 * width eases from one word to the next, so the rest of the line glides rather
 * than jumps.
 */
export function RotatingWord({ words, interval = 2600 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [widths, setWidths] = useState<number[] | null>(null);
  const items = useRef<(HTMLSpanElement | null)[]>([]);
  const slot = useRef<HTMLSpanElement>(null);

  // Measured before paint, so switching to an explicit width changes nothing on screen.
  useLayoutEffect(() => {
    const measure = () => setWidths(items.current.map((el) => el?.getBoundingClientRect().width ?? 0));
    measure();
    // Geist arrives after first paint; words are wider once it does.
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Holds its word while the hero is scrolled away (HomeEffects sets data-paused) or the tab is hidden.
    const id = window.setInterval(() => {
      if (document.hidden || slot.current?.closest("[data-paused]")) return;
      setIndex((i) => (i + 1) % words.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  const previous = (index - 1 + words.length) % words.length;

  return (
    <span ref={slot} className="rotating-word" style={widths ? { width: widths[index] } : undefined}>
      {/* In flow and invisible: gives the slot its height and, before measuring, its width. */}
      <span className="rotating-word-strut">{words[0]}</span>
      {words.map((word, i) => (
        <span
          key={word}
          ref={(el) => {
            items.current[i] = el;
          }}
          className="rotating-word-item foil-text"
          data-state={i === index ? "in" : i === previous ? "out" : "next"}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
