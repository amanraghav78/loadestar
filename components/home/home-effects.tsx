"use client";

import { useEffect } from "react";

/**
 * The home page's motion, in one place and all optional:
 *
 * - `[data-reveal]` blocks rise into place the first time they scroll into
 *   view, and stay put afterwards. `[data-reveal-stagger]` does the same to
 *   each item of its lists in turn. Anything already on screen when the page
 *   loads is left alone, so nothing visible ever blinks out and back in.
 * - The hero's endless animations stop while it is scrolled out of view
 *   (`data-paused`, read in globals.css and by RotatingWord).
 * - In the hero, a soft light follows the pointer (`--hx`/`--hy`/`--hero-lit`,
 *   read by `.hero-light`). Across cards, a glow does the same (`--mx`/`--my`,
 *   read by `.spotlight .metal-card::after`).
 *
 * The page is complete without any of this: no script, a reduced-motion
 * preference, or a touch screen simply leaves it static.
 */
export function HomeEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-home]");
    if (!root) return;
    const cleanups: (() => void)[] = [];

    // The hero's loops (foil, glint, beam, marquee) pause while it is out of view.
    const heroSection = root.querySelector<HTMLElement>("[data-hero]");
    if (heroSection && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) =>
        heroSection.toggleAttribute("data-paused", !entry.isIntersecting),
      );
      observer.observe(heroSection);
      cleanups.push(() => observer.disconnect());
    }

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.replace("reveal-pending", "reveal-in");
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      for (const el of root.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-stagger]")) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) continue;
        if (el.hasAttribute("data-reveal-stagger")) {
          for (const list of el.querySelectorAll("ul")) {
            [...list.children].forEach((item, i) => (item as HTMLElement).style.setProperty("--i", String(i)));
          }
        }
        el.classList.add("reveal-pending");
        observer.observe(el);
      }
      cleanups.push(() => observer.disconnect());
    }

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const hero = root.querySelector<HTMLElement>("[data-hero]");
      let frame = 0;
      let last: PointerEvent | null = null;

      const paint = () => {
        frame = 0;
        if (!last) return;
        if (hero) {
          const box = hero.getBoundingClientRect();
          const inside = last.clientY >= box.top && last.clientY <= box.bottom;
          hero.style.setProperty("--hx", `${last.clientX - box.left}px`);
          hero.style.setProperty("--hy", `${last.clientY - box.top}px`);
          hero.style.setProperty("--hero-lit", inside ? "1" : "0");
        }
        const card = (last.target as Element | null)?.closest?.<HTMLElement>(".metal-card");
        if (card) {
          const box = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${last.clientX - box.left}px`);
          card.style.setProperty("--my", `${last.clientY - box.top}px`);
        }
      };
      const onMove = (event: PointerEvent) => {
        last = event;
        if (!frame) frame = requestAnimationFrame(paint);
      };
      const onLeave = () => hero?.style.setProperty("--hero-lit", "0");

      root.addEventListener("pointermove", onMove, { passive: true });
      root.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        root.removeEventListener("pointermove", onMove);
        root.removeEventListener("pointerleave", onLeave);
        cancelAnimationFrame(frame);
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
