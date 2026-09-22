import "server-only";
import { del, get, put, BlobNotFoundError } from "@vercel/blob";
import type { ObjectStore, StoredObject } from "@/lib/storage";

/**
 * Resumes in a **private** Vercel Blob store: every read and write is
 * authenticated, and no URL works without our credentials. Running on Vercel
 * with the store connected to the project, the SDK authenticates through OIDC;
 * elsewhere it falls back to BLOB_READ_WRITE_TOKEN.
 *
 * Keys are unique per upload (lib/resume.ts), so a blob is never overwritten
 * and the read cache can't serve a stale one.
 */
export function vercelBlobStore(): ObjectStore {
  return {
    async put(key, bytes, contentType) {
      // The SDK takes a Buffer, a Blob or a stream, not a bare Uint8Array.
      await put(key, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false });
    },

    async get(key): Promise<StoredObject | null> {
      const result = await get(key, { access: "private" });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return {
        body: result.stream,
        size: result.blob.size,
        contentType: result.blob.contentType,
      };
    },

    async delete(key) {
      try {
        await del(key);
      } catch (err) {
        // Already gone is the outcome we wanted anyway.
        if (!(err instanceof BlobNotFoundError)) throw err;
      }
    },
  };
}
