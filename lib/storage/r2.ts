import "server-only";
import { AwsClient } from "aws4fetch";
import type { ObjectStore, StoredObject } from "@/lib/storage";

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

/**
 * Cloudflare R2 through its S3-compatible API, signed with aws4fetch (a few KB)
 * rather than the AWS SDK. The bucket is private: every read and write goes
 * through our own credentials, and no URL is ever handed to a browser.
 */
export function r2Store({ accountId, accessKeyId, secretAccessKey, bucket }: R2Config): ObjectStore {
  // aws4fetch retries ten times by default, which would keep a function alive
  // long after the caller has given up. Two attempts, then report the failure.
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto", retries: 2 });
  const url = (key: string) =>
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    async put(key, bytes, contentType) {
      const res = await client.fetch(url(key), {
        method: "PUT",
        body: bytes as unknown as BodyInit,
        headers: { "Content-Type": contentType, "Content-Length": String(bytes.length) },
      });
      if (!res.ok) throw new Error(`R2 rejected the upload (${res.status})`);
    },

    async get(key): Promise<StoredObject | null> {
      const res = await client.fetch(url(key));
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new Error(`R2 read failed (${res.status})`);
      const size = Number(res.headers.get("content-length"));
      return {
        body: res.body as ReadableStream<Uint8Array>,
        size: Number.isFinite(size) && size > 0 ? size : null,
        contentType: res.headers.get("content-type"),
      };
    },

    async delete(key) {
      const res = await client.fetch(url(key), { method: "DELETE" });
      // R2 answers 204 whether or not the object was there; 404 is fine too.
      if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status})`);
    },
  };
}
