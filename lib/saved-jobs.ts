"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MAX_SAVED, reconcileSaves, type StoredSaves } from "@/lib/saved-jobs-merge";

/**
 * Saved roles live in localStorage so they work without an account, and sync to
 * the account once someone signs in. A tiny external store keeps every bookmark
 * button and the header counter in step, including across tabs.
 *
 * `owner` records whose roles these are, so the next person to sign in on a
 * shared computer never sees them.
 */
const KEY = "lodestar:saved-jobs:v1";
const EMPTY: string[] = [];

let cache: StoredSaves | null = null;
const listeners = new Set<() => void>();

function readStored(): StoredSaves {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    // Version 1 was a bare array of ids; it reads as "nobody's yet".
    cache = Array.isArray(parsed)
      ? { v: 2, owner: null, ids: parsed.filter((v): v is string => typeof v === "string") }
      : isStored(parsed)
        ? parsed
        : { v: 2, owner: null, ids: [] };
  } catch {
    cache = { v: 2, owner: null, ids: [] };
  }
  return cache;
}

function isStored(value: unknown): value is StoredSaves {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredSaves>;
  return Array.isArray(candidate.ids) && (typeof candidate.owner === "string" || candidate.owner === null);
}

const read = (): string[] => readStored().ids;

function writeStored(next: StoredSaves) {
  cache = { ...next, ids: next.ids.slice(0, MAX_SAVED) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode / quota — keep the in-memory copy for this session.
  }
  listeners.forEach((l) => l());
}

function write(ids: string[]) {
  writeStored({ ...readStored(), ids });
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

/**
 * Tells the account about a change. The local write already happened, so a
 * failure here costs nothing this session: the next page load reconciles.
 */
function sync(body: { save?: string; unsave?: string[] }) {
  if (!readStored().owner) return;
  void fetch("/api/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** Called by components/saved-jobs-sync once the session is known. */
export function applySession(userId: string | null, serverIds: string[]) {
  const result = reconcileSaves(readStored(), userId, serverIds);
  writeStored({ v: 2, owner: result.owner, ids: result.ids });
  return result.toUpload;
}

/** Signing out leaves nothing behind on the device. */
export function clearSavedJobs() {
  writeStored({ v: 2, owner: null, ids: [] });
}

export function useSavedJobs() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((id: string) => {
    const current = read();
    const saved = current.includes(id);
    write(saved ? current.filter((x) => x !== id) : [id, ...current]);
    sync(saved ? { unsave: [id] } : { save: id });
  }, []);

  const remove = useCallback((toRemove: string[]) => {
    write(read().filter((x) => !toRemove.includes(x)));
    sync({ unsave: toRemove });
  }, []);

  return { ids, toggle, remove, isSaved: (id: string) => ids.includes(id) };
}
