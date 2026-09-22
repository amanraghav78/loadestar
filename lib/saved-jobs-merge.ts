/**
 * Deciding what a browser's saved roles should become once we know who (if
 * anyone) is signed in. Pure so it can be unit-tested: the storage and network
 * side lives in lib/saved-jobs.ts.
 */

export const MAX_SAVED = 100;

/** What we keep in localStorage. `owner` is the user those ids belong to, or null for a signed-out visitor. */
export type StoredSaves = { v: 2; owner: string | null; ids: string[] };

export type Reconciled = {
  ids: string[];
  owner: string | null;
  /** Ids to push to the account, on the one-time merge after signing in. */
  toUpload: string[];
};

export function reconcileSaves(stored: StoredSaves, userId: string | null, serverIds: string[]): Reconciled {
  // Signed out: the browser is the only home for these, so leave them alone.
  if (!userId) {
    return stored.owner === null
      ? { ids: stored.ids, owner: null, toUpload: [] }
      : // They just signed out: their account's roles shouldn't linger here.
        { ids: [], owner: null, toUpload: [] };
  }

  // First sign-in on this browser: keep what they collected before, and add it to the account.
  if (stored.owner === null) {
    const merged = [...stored.ids, ...serverIds.filter((id) => !stored.ids.includes(id))].slice(0, MAX_SAVED);
    return { ids: merged, owner: userId, toUpload: stored.ids.slice(0, MAX_SAVED) };
  }

  // Already merged, or a different person on a shared computer: the account wins.
  return { ids: serverIds.slice(0, MAX_SAVED), owner: userId, toUpload: [] };
}
