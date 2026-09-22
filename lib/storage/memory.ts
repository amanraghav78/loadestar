import "server-only";
import type { ObjectStore } from "@/lib/storage";

/**
 * Development and test store. Files live in the process, so they vanish on
 * restart and are never shared between instances: enough to exercise upload,
 * download and delete without a Cloudflare account, and never used in production.
 */
export function memoryStore(): ObjectStore {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();

  return {
    async put(key, bytes, contentType) {
      files.set(key, { bytes: new Uint8Array(bytes), contentType });
    },

    async get(key) {
      const file = files.get(key);
      if (!file) return null;
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(file.bytes);
            controller.close();
          },
        }),
        size: file.bytes.length,
        contentType: file.contentType,
      };
    },

    async delete(key) {
      files.delete(key);
    },
  };
}
