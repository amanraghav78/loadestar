import { describe, expect, it } from "vitest";
import { isAdminAuthorization } from "@/lib/admin-auth";

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe("isAdminAuthorization", () => {
  it("accepts the configured credentials", () => {
    expect(isAdminAuthorization(basic("admin", "correct-horse-battery"))).toBe(true);
  });

  it("treats everything after the first colon as the password", () => {
    expect(isAdminAuthorization(basic("admin", "correct-horse-battery:x"))).toBe(false);
  });

  it.each([
    [null],
    [""],
    ["Bearer abc"],
    ["Basic !!!notbase64"],
    [basic("admin", "wrong")],
    [basic("root", "correct-horse-battery")],
    [basic("admin", "")],
  ])("rejects %s", (header) => {
    expect(isAdminAuthorization(header)).toBe(false);
  });
});
