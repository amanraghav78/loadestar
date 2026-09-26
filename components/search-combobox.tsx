"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Globe, History, MapPin, Search, Tag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Suggestion, SuggestField, SuggestKind } from "@/lib/suggest";

export type SearchComboboxProps = { form: HTMLFormElement };

type Item = Omit<Suggestion, "k"> & { k: SuggestKind | "recent" };
type View = { field: SuggestField; items: Item[]; active: number };
type Box = { top: number; left: number; width: number };

const DEBOUNCE_MS = 120;
const RECENT_KEY = "lodestar:recent-searches";
const RECENT_MAX = 5;

const KIND: Record<Item["k"], { hint: string; icon: LucideIcon }> = {
  title: { hint: "Title", icon: Search },
  company: { hint: "Company", icon: Building2 },
  skill: { hint: "Skill", icon: Tag },
  city: { hint: "City", icon: MapPin },
  remote: { hint: "Remote", icon: Globe },
  recent: { hint: "Recent", icon: History },
};

function readRecent(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  try {
    const next = [term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage off (private mode, blocked): recents are a nicety.
  }
}

/**
 * Suggestions for the search form's two inputs, loaded on demand by
 * <SearchSuggest>. It follows the WAI-ARIA 1.2 combobox pattern on the inputs
 * the server rendered: each becomes role=combobox and owns one listbox, the
 * highlighted option is announced through aria-activedescendant while focus
 * stays in the input. Up/Down move, Enter picks, Esc closes, Tab moves on.
 *
 * Picking a title, skill or recent search runs the search; a company opens its
 * page; a city fills the location box. The list is portalled to <body> and
 * placed under the form, so the hero's `overflow-hidden` can't clip it, and it
 * sits below the sticky header (z-40) when the page scrolls.
 */
export function SearchCombobox({ form }: SearchComboboxProps) {
  const router = useRouter();
  const listId = `${useId()}-suggest`;
  const optionId = (i: number) => `${listId}-${i}`;
  const [view, setView] = useState<View | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const actions = useRef<{ pick: (i: number) => void; hover: (i: number) => void } | null>(null);

  useEffect(() => {
    const inputs = (["q", "location"] as const).flatMap((field) => {
      const el = form.elements.namedItem(field);
      return el instanceof HTMLInputElement ? [{ field, el }] : [];
    });
    const cache = new Map<string, Item[]>();
    let current: (View & { input: HTMLInputElement }) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: AbortController | null = null;

    const render = () =>
      setView(current ? { field: current.field, items: current.items, active: current.active } : null);

    const place = () => {
      if (!current) return;
      const anchor = current.input.closest("label") ?? current.input;
      const a = anchor.getBoundingClientRect();
      const f = form.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      // Always under the whole form, so the list never covers the other field or
      // the Search button (the phone hero stacks them). Phones: the form's width.
      // Wider: from the field's left edge.
      const narrow = vw < 640;
      const width = Math.min(narrow ? f.width : Math.max(a.width, 288), vw - 32);
      const left = Math.min(Math.max(16, narrow ? f.left : a.left), vw - 16 - width);
      const top = f.bottom + 8;
      setBox({ top: top + window.scrollY, left: left + window.scrollX, width });
    };

    const setActive = (i: number) => {
      if (!current) return;
      current.active = i;
      if (i >= 0) current.input.setAttribute("aria-activedescendant", optionId(i));
      else current.input.removeAttribute("aria-activedescendant");
      render();
    };

    const close = () => {
      clearTimeout(timer);
      pending?.abort();
      if (!current) return;
      current.input.setAttribute("aria-expanded", "false");
      current.input.removeAttribute("aria-activedescendant");
      current = null;
      render();
    };

    const open = (field: SuggestField, input: HTMLInputElement, items: Item[]) => {
      if (!items.length) return close();
      if (current && current.input !== input) close();
      current = { field, input, items, active: -1 };
      input.setAttribute("aria-expanded", "true");
      input.removeAttribute("aria-activedescendant");
      place();
      render();
    };

    const lookup = (field: SuggestField, input: HTMLInputElement) => {
      clearTimeout(timer);
      pending?.abort();
      const term = input.value.trim();
      // An empty keyword box offers the last few searches instead.
      if (field === "q" && !term) {
        return open(
          field,
          input,
          readRecent().map((v) => ({ k: "recent", v })),
        );
      }
      const key = `${field}\n${term.toLowerCase()}`;
      const known = cache.get(key);
      if (known) return open(field, input, known);

      timer = setTimeout(async () => {
        const request = new AbortController();
        pending = request;
        try {
          const res = await fetch(`/api/suggest?field=${field}&term=${encodeURIComponent(term)}`, {
            signal: request.signal,
          });
          if (!res.ok) return;
          const { items } = (await res.json()) as { items: Item[] };
          cache.set(key, items);
          if (document.activeElement === input && input.value.trim() === term) open(field, input, items);
        } catch {
          // Aborted by the next keystroke, or offline: the form still searches.
        }
      }, DEBOUNCE_MS);
    };

    const pick = (i: number) => {
      if (!current) return;
      const item = current.items[i];
      const { field, input } = current;
      if (!item) return;
      close();
      if (item.k === "company" && item.s) {
        router.push(`/companies/${item.s}`);
        return;
      }
      input.value = item.v;
      // A role runs the search; a place just fills its box, the keyword may still be coming.
      if (field === "q") form.requestSubmit();
    };

    actions.current = { pick, hover: (i) => current && current.active !== i && setActive(i) };

    const cleanups: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      el.addEventListener(type, fn);
      cleanups.push(() => el.removeEventListener(type, fn));
    };

    for (const { field, el } of inputs) {
      const before = { autocomplete: el.getAttribute("autocomplete") };
      el.setAttribute("role", "combobox");
      el.setAttribute("aria-autocomplete", "list");
      el.setAttribute("aria-expanded", "false");
      el.setAttribute("aria-controls", listId);
      // The browser's own history list would sit on top of ours.
      el.setAttribute("autocomplete", "off");
      cleanups.push(() => {
        for (const attr of ["role", "aria-autocomplete", "aria-expanded", "aria-controls", "aria-activedescendant"]) {
          el.removeAttribute(attr);
        }
        if (before.autocomplete === null) el.removeAttribute("autocomplete");
        else el.setAttribute("autocomplete", before.autocomplete);
      });

      on(el, "input", () => lookup(field, el));
      on(el, "focus", () => {
        if (!el.value.trim()) lookup(field, el);
      });
      on(el, "blur", () => {
        if (current?.input === el) close();
      });
      on(el, "keydown", (e) => {
        if (e.isComposing) return;
        const n = current?.input === el ? current.items.length : 0;
        switch (e.key) {
          case "ArrowDown":
          case "ArrowUp": {
            e.preventDefault();
            if (!n || !current) return lookup(field, el);
            const down = e.key === "ArrowDown";
            const i = current.active;
            setActive(down ? (i + 1) % n : i <= 0 ? n - 1 : i - 1);
            return;
          }
          case "Enter":
            if (n && current && current.active >= 0) {
              e.preventDefault();
              pick(current.active);
            }
            return;
          case "Escape":
            if (n) {
              e.preventDefault();
              close();
            }
            return;
          case "Tab":
            close();
            return;
        }
      });
    }

    on(form, "submit", () => {
      close();
      const q = inputs.find((i) => i.field === "q")?.el.value.trim();
      if (q) saveRecent(q);
    });

    const onResize = () => place();
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));

    // Loaded because someone focused or typed: catch up with what they did meanwhile.
    const frame = requestAnimationFrame(() => {
      const hit = inputs.find(({ el }) => el === document.activeElement);
      if (hit && (hit.el.value !== hit.el.defaultValue || !hit.el.value.trim())) lookup(hit.field, hit.el);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      pending?.abort();
      for (const fn of cleanups) fn();
      actions.current = null;
    };
    // optionId only derives from listId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, listId, router]);

  // Keep the highlighted option in view as the arrows move through a long list.
  useEffect(() => {
    if (view && view.active >= 0) document.getElementById(optionId(view.active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.active]);

  const open = !!view && !!box;
  const label = view?.field === "location" ? "Places" : "Suggestions";

  return createPortal(
    <>
      <div
        className="metal-panel absolute z-30 rounded-2xl p-1.5"
        style={open ? { top: box.top, left: box.left, width: box.width } : undefined}
        hidden={!open}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="max-h-[min(22rem,60svh)] overflow-y-auto overscroll-contain"
          // Keep focus in the input when an option is pressed.
          onMouseDown={(e) => e.preventDefault()}
        >
          {view?.items.map((item, i) => {
            const { hint, icon: Icon } = KIND[item.k];
            const active = i === view.active;
            return (
              <li
                key={`${item.k}:${item.v}`}
                id={optionId(i)}
                role="option"
                aria-selected={active}
                onClick={() => actions.current?.pick(i)}
                onPointerMove={() => actions.current?.hover(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm select-none",
                  active ? "bg-tint-strong text-fg" : "text-muted",
                )}
              >
                <Icon className="text-subtle size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <Highlight text={item.v} range={item.m} />
                  {item.a && <span className="text-subtle"> · {item.a}</span>}
                </span>
                <span className="text-subtle shrink-0 text-[11px] font-medium tracking-wide uppercase">{hint}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {/* Outside the panel so it is always mounted: a live region that appears with its text is often not read. */}
      <p role="status" className="sr-only">
        {open ? `${view.items.length} ${view.items.length === 1 ? "suggestion" : "suggestions"}` : ""}
      </p>
    </>,
    document.body,
  );
}

function Highlight({ text, range }: { text: string; range?: [number, number] }) {
  if (!range) return <span className="text-fg">{text}</span>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="text-fg bg-transparent font-semibold">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
