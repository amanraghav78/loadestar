import { describe, expect, it } from "vitest";
import { descriptionToPlainText } from "@/components/job-description";

describe("descriptionToPlainText", () => {
  it("strips markup and truncates on a word boundary with an ellipsis", () => {
    const text = "## Role\n\n- Build things\n- Ship things\n\nWe reply to everyone.";
    expect(descriptionToPlainText(text)).toBe("Role Build things Ship things We reply to everyone.");
    expect(descriptionToPlainText(text, 12)).toBe("Role Build…");
  });
});
