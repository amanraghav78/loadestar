"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  applyTheme,
  readPreference,
  resolveTheme,
  storePreference,
  THEME_KEY,
  type ThemePreference,
} from "@/lib/theme";

/**
 * One button, three states, in the order people go looking for them. A tiny
 * external store — the same shape as saved roles — keeps every tab in step and
 * survives the toggle unmounting.
 */
const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };

let cache: ThemePreference | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ThemePreference {
  cache ??= readPreference();
  return cache;
}

/** The server can't know the choice; the inline script fixes the DOM before paint. */
const getServerSnapshot = (): ThemePreference => "system";

function paint() {
  applyTheme(resolveTheme(getSnapshot()));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  // On "system", follow the machine if it changes theme while the tab is open.
  const onMedia = () => {
    if (getSnapshot() === "system") paint();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    cache = readPreference();
    paint();
    listeners.forEach((l) => l());
  };
  media.addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

function choose(preference: ThemePreference) {
  cache = preference;
  storePreference(preference);
  paint();
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The inline script in <head> already painted the right theme. This only
  // re-applies it after React's dev-only remount strips the attribute off <html>.
  useLayoutEffect(paint, [preference]);

  const Icon = ICON[preference];
  return (
    <button
      type="button"
      onClick={() => choose(NEXT[preference])}
      title={`Theme: ${LABEL[preference]}`}
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[NEXT[preference]].toLowerCase()}.`}
      className={cn("btn-steel flex size-8 shrink-0 items-center justify-center rounded-full", className)}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}
