"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { SearchComboboxProps } from "@/components/search-combobox";

/** Wakes on the first sign someone is about to search. */
const WAKE_EVENTS = ["focusin", "pointerover", "pointerdown", "input"] as const;

/**
 * The search box's suggestions, as a tiny island: it renders nothing and ships
 * a few hundred bytes. The combobox itself (components/search-combobox.tsx) is
 * fetched the first time someone points at, focuses or types in the form, so
 * none of it is on the home page's first paint. It then enhances the inputs
 * already on the page; without JavaScript the form is the plain GET form.
 */
export function SearchSuggest() {
  const marker = useRef<HTMLSpanElement>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const [Combobox, setCombobox] = useState<ComponentType<SearchComboboxProps> | null>(null);

  useEffect(() => {
    const el = marker.current?.closest("form");
    if (!el) return;
    let done = false;
    const wake = () => {
      if (done) return;
      done = true;
      for (const type of WAKE_EVENTS) el.removeEventListener(type, wake);
      import("@/components/search-combobox").then(
        (m) => {
          setForm(el);
          setCombobox(() => m.SearchCombobox);
        },
        // A failed chunk (offline, a deploy in between) leaves the plain form.
        () => {},
      );
    };
    for (const type of WAKE_EVENTS) el.addEventListener(type, wake, { passive: true });
    // Focused before the page hydrated.
    if (el.contains(document.activeElement)) wake();
    return () => {
      for (const type of WAKE_EVENTS) el.removeEventListener(type, wake);
    };
  }, []);

  return (
    <>
      <span ref={marker} hidden />
      {Combobox && form && <Combobox form={form} />}
    </>
  );
}
