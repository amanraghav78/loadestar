import { describe, expect, it } from "vitest";
import {
  checkResumeBytes,
  MAX_RESUME_BYTES,
  resumeObjectKey,
  sanitizeResumeFilename,
  sniffResumeType,
} from "@/lib/resume";

const pdf = (extra = 0) => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new Array<number>(extra).fill(0x20)]);

describe("sniffResumeType", () => {
  it("accepts a real PDF", () => {
    expect(sniffResumeType(pdf(100))).toBe("application/pdf");
  });

  it.each([
    ["a text file renamed .pdf", new TextEncoder().encode("Dear hiring manager, this is not a PDF")],
    ["a DOCX (zip container)", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])],
    ["a legacy .doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])],
    ["a PNG", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["an empty file", new Uint8Array([])],
    ["a truncated header", new Uint8Array([0x25, 0x50])],
    ["%PDF- not at the start", new Uint8Array([0x20, 0x25, 0x50, 0x44, 0x46, 0x2d])],
  ])("rejects %s", (_label, bytes) => {
    expect(sniffResumeType(bytes)).toBeNull();
  });
});

describe("checkResumeBytes", () => {
  it("passes a PDF inside the size limit", () => {
    expect(checkResumeBytes(pdf(1000))).toBeNull();
  });

  it("allows exactly the limit but not a byte more", () => {
    const atLimit = new Uint8Array(MAX_RESUME_BYTES);
    atLimit.set(pdf());
    expect(checkResumeBytes(atLimit)).toBeNull();

    const overLimit = new Uint8Array(MAX_RESUME_BYTES + 1);
    overLimit.set(pdf());
    expect(checkResumeBytes(overLimit)).toBe("too_large");
  });

  it("names the reason so the candidate gets a useful message", () => {
    expect(checkResumeBytes(new Uint8Array([]))).toBe("empty");
    expect(checkResumeBytes(new TextEncoder().encode("nope"))).toBe("not_a_pdf");
  });
});

describe("sanitizeResumeFilename", () => {
  it.each([
    ["Aman Resume.pdf", "Aman Resume.pdf"],
    ["../../etc/passwd", "passwd.pdf"],
    ["C:\\Users\\admin\\cv.pdf", "cv.pdf"],
    ['say "hi".pdf', "say hi.pdf"],
    ["resume\r\nContent-Disposition: attachment.pdf", "resumeContent-Disposition: attachment.pdf"],
    ["   ", "resume.pdf"],
    ["", "resume.pdf"],
    ["résumé.PDF", "résumé.pdf"],
    ["no-extension", "no-extension.pdf"],
  ])("%s -> %s", (input, expected) => {
    expect(sanitizeResumeFilename(input)).toBe(expected);
  });

  it("keeps the name short and always .pdf", () => {
    const name = sanitizeResumeFilename(`${"a".repeat(400)}.pdf`);
    expect(name.endsWith(".pdf")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(104);
  });

  it("leaves nothing that could break out of a Content-Disposition header", () => {
    const name = sanitizeResumeFilename('cv";\r\nX-Injected: 1.pdf');
    expect(name).not.toMatch(/["\\\r\n]/);
  });
});

describe("resumeObjectKey", () => {
  it("namespaces by user and never reuses a key", () => {
    const a = resumeObjectKey("user_123");
    const b = resumeObjectKey("user_123");
    expect(a).toMatch(/^resumes\/user_123\/[0-9a-f-]{36}\.pdf$/);
    expect(a).not.toBe(b);
  });
});
