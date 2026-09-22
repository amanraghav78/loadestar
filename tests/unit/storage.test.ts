import { afterEach, describe, expect, it, vi } from "vitest";
import { r2Store } from "@/lib/storage/r2";
import { memoryStore } from "@/lib/storage/memory";

const config = {
  accountId: "acct123",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "lodestar-resumes",
};

const read = async (stream: ReadableStream<Uint8Array>) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
};

function stubFetch(response: Response) {
  const calls: Request[] = [];
  vi.stubGlobal("fetch", async (input: Request | string, init?: RequestInit) => {
    calls.push(input instanceof Request ? input : new Request(input, init));
    return response;
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("r2Store", () => {
  it("writes to the bucket path and signs the request", async () => {
    const calls = stubFetch(new Response(null, { status: 200 }));
    await r2Store(config).put("resumes/u1/file.pdf", new Uint8Array([1, 2, 3]), "application/pdf");

    const [request] = calls;
    expect(request!.method).toBe("PUT");
    expect(request!.url).toBe("https://acct123.r2.cloudflarestorage.com/lodestar-resumes/resumes/u1/file.pdf");
    expect(request!.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("reads a missing object as null rather than throwing", async () => {
    stubFetch(new Response(null, { status: 404 }));
    await expect(r2Store(config).get("resumes/u1/gone.pdf")).resolves.toBeNull();
  });

  it("treats a delete of something already gone as success", async () => {
    stubFetch(new Response(null, { status: 404 }));
    await expect(r2Store(config).delete("resumes/u1/gone.pdf")).resolves.toBeUndefined();
  });

  it("throws when the bucket refuses, so account deletion can abort", async () => {
    stubFetch(new Response("denied", { status: 403 }));
    await expect(r2Store(config).delete("resumes/u1/file.pdf")).rejects.toThrow(/403/);
  });

  it("throws on a failed upload instead of reporting success", async () => {
    stubFetch(new Response("nope", { status: 500 }));
    await expect(r2Store(config).put("k", new Uint8Array([1]), "application/pdf")).rejects.toThrow(/500/);
  });
});

describe("memoryStore", () => {
  it("round-trips a file and forgets it after delete", async () => {
    const store = memoryStore();
    await store.put("resumes/u1/file.pdf", new Uint8Array([37, 80, 68, 70]), "application/pdf");

    const found = await store.get("resumes/u1/file.pdf");
    expect(found?.contentType).toBe("application/pdf");
    expect(await read(found!.body)).toEqual(Buffer.from([37, 80, 68, 70]));

    await store.delete("resumes/u1/file.pdf");
    expect(await store.get("resumes/u1/file.pdf")).toBeNull();
  });

  it("returns null for a key it never had", async () => {
    expect(await memoryStore().get("nope")).toBeNull();
  });
});
