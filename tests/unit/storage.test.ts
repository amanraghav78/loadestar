import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "@/lib/storage/memory";

const blob = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

class FakeBlobNotFoundError extends Error {}

vi.mock("@vercel/blob", () => ({
  put: blob.put,
  get: blob.get,
  del: blob.del,
  BlobNotFoundError: FakeBlobNotFoundError,
}));

const { vercelBlobStore } = await import("@/lib/storage/vercel-blob");

const stream = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

const read = async (body: ReadableStream<Uint8Array>) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
};

afterEach(() => vi.clearAllMocks());

describe("vercelBlobStore", () => {
  it("writes privately, under our own key", async () => {
    await vercelBlobStore().put("resumes/u1/file.pdf", new Uint8Array([1, 2, 3]), "application/pdf");

    expect(blob.put).toHaveBeenCalledWith("resumes/u1/file.pdf", Buffer.from([1, 2, 3]), {
      access: "private",
      contentType: "application/pdf",
      // A random suffix would lose the key we recorded against the candidate.
      addRandomSuffix: false,
    });
  });

  it("reads a stored file back", async () => {
    blob.get.mockResolvedValue({
      statusCode: 200,
      stream: stream(new Uint8Array([37, 80, 68, 70])),
      blob: { size: 4, contentType: "application/pdf" },
    });

    const found = await vercelBlobStore().get("resumes/u1/file.pdf");
    expect(blob.get).toHaveBeenCalledWith("resumes/u1/file.pdf", { access: "private" });
    expect(found?.size).toBe(4);
    expect(await read(found!.body)).toEqual(Buffer.from([37, 80, 68, 70]));
  });

  it.each([
    ["the blob is missing", null],
    ["the store answers 304", { statusCode: 304, stream: null, blob: {} }],
  ])("reads null when %s", async (_label, result) => {
    blob.get.mockResolvedValue(result);
    await expect(vercelBlobStore().get("resumes/u1/gone.pdf")).resolves.toBeNull();
  });

  it("treats deleting something already gone as success", async () => {
    blob.del.mockRejectedValue(new FakeBlobNotFoundError("gone"));
    await expect(vercelBlobStore().delete("resumes/u1/gone.pdf")).resolves.toBeUndefined();
  });

  it("reports any other delete failure, so account deletion can abort", async () => {
    blob.del.mockRejectedValue(new Error("service unavailable"));
    await expect(vercelBlobStore().delete("resumes/u1/file.pdf")).rejects.toThrow(/service unavailable/);
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
