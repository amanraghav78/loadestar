"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Saved roles live in localStorage — there are no accounts. A tiny external
 * store keeps every bookmark button and the header counter in sync, including
 * across tabs via the `storage` event.
 */
const KEY = "lodestar:saved-jobs:v1";
const MAX_SAVED = 100;
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ids: string[]) {
  cache = ids.slice(0, MAX_SAVED);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode / quota — keep the in-memory copy for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSavedJobs() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((x) => x !== id) : [id, ...current]);
  }, []);

  const remove = useCallback((toRemove: string[]) => {
    write(read().filter((x) => !toRemove.includes(x)));
  }, []);

  return { ids, toggle, remove, isSaved: (id: string) => ids.includes(id) };
}
