import "server-only";
import { env } from "@/lib/env";
import { r2Store } from "@/lib/storage/r2";
import { memoryStore } from "@/lib/storage/memory";
import { testModeEnabled } from "@/lib/test-mode";

export type StoredObject = { body: ReadableStream<Uint8Array>; size: number | null; contentType: string | null };

/** Private file storage for resumes. Keys are opaque; see lib/resume.ts. */
export type ObjectStore = {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Null when the object is gone, so a stale key reads as "no resume" rather than an error. */
  get(key: string): Promise<StoredObject | null>;
  /** Resolves when the object is gone, including when it never existed. Throws on anything else. */
  delete(key: string): Promise<void>;
};

const configured =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
    ? {
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
      }
    : null;

/**
 * R2 when it is configured; otherwise an in-process store, so development and
 * the test suite work with no Cloudflare account. A live deployment with no
 * bucket turns resume upload off rather than pretending to keep files.
 */
export const resumeStore: ObjectStore | null = configured
  ? r2Store(configured)
  : process.env.NODE_ENV !== "production" || testModeEnabled
    ? memoryStore()
    : null;

export const resumeUploadEnabled = resumeStore !== null;
