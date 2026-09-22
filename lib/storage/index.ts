import "server-only";
import { env } from "@/lib/env";
import { memoryStore } from "@/lib/storage/memory";
import { vercelBlobStore } from "@/lib/storage/vercel-blob";
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

// Vercel adds BLOB_STORE_ID when a Blob store is connected to the project, and
// authenticates through OIDC from then on; BLOB_READ_WRITE_TOKEN covers
// everywhere else, such as a local machine.
const blobConfigured = Boolean(env.BLOB_STORE_ID ?? env.BLOB_READ_WRITE_TOKEN);

/**
 * The private Blob store when it is configured; otherwise an in-process store,
 * so development and the test suite work with no storage account at all. A live
 * deployment with no store turns resume upload off rather than pretending to
 * keep files.
 */
export const resumeStore: ObjectStore | null = blobConfigured
  ? vercelBlobStore()
  : process.env.NODE_ENV !== "production" || testModeEnabled
    ? memoryStore()
    : null;

export const resumeUploadEnabled = resumeStore !== null;
