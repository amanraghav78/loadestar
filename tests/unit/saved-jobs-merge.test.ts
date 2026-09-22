import { describe, expect, it } from "vitest";
import { MAX_SAVED, reconcileSaves, type StoredSaves } from "@/lib/saved-jobs-merge";

const stored = (owner: string | null, ids: string[]): StoredSaves => ({ v: 2, owner, ids });

describe("reconcileSaves", () => {
  it("leaves a signed-out visitor's roles exactly as they are", () => {
    const result = reconcileSaves(stored(null, ["a", "b"]), null, []);
    expect(result).toEqual({ ids: ["a", "b"], owner: null, toUpload: [] });
  });

  it("merges what the browser collected into the account on first sign-in", () => {
    const result = reconcileSaves(stored(null, ["a", "b"]), "user1", ["b", "c"]);
    expect(result.ids).toEqual(["a", "b", "c"]);
    expect(result.owner).toBe("user1");
    expect(result.toUpload).toEqual(["a", "b"]);
  });

  it("merges only once, so signing in again does not re-upload", () => {
    const first = reconcileSaves(stored(null, ["a"]), "user1", []);
    const second = reconcileSaves(stored(first.owner, first.ids), "user1", ["a"]);
    expect(second.toUpload).toEqual([]);
    expect(second.ids).toEqual(["a"]);
  });

  it("lets the account win once the browser is already theirs", () => {
    const result = reconcileSaves(stored("user1", ["stale"]), "user1", ["fresh"]);
    expect(result).toEqual({ ids: ["fresh"], owner: "user1", toUpload: [] });
  });

  it("never shows one person's roles to the next person on a shared computer", () => {
    const result = reconcileSaves(stored("userA", ["a1", "a2"]), "userB", ["b1"]);
    expect(result).toEqual({ ids: ["b1"], owner: "userB", toUpload: [] });
  });

  it("clears the account's roles from the browser on sign-out", () => {
    const result = reconcileSaves(stored("user1", ["a", "b"]), null, []);
    expect(result).toEqual({ ids: [], owner: null, toUpload: [] });
  });

  it("keeps the cap when merging two full lists", () => {
    const local = Array.from({ length: 80 }, (_, i) => `local${i}`);
    const server = Array.from({ length: 80 }, (_, i) => `server${i}`);
    const result = reconcileSaves(stored(null, local), "user1", server);
    expect(result.ids).toHaveLength(MAX_SAVED);
    expect(result.ids.slice(0, 80)).toEqual(local);
    expect(result.toUpload).toHaveLength(80);
  });

  it("does not duplicate a role saved in both places", () => {
    const result = reconcileSaves(stored(null, ["same"]), "user1", ["same"]);
    expect(result.ids).toEqual(["same"]);
  });
});
