import { describe, expect, it } from "vitest";
import { descriptionToPlainText, headingText } from "@/components/job-description";

describe("headingText", () => {
  it("reads our own headings", () => {
    expect(headingText("## About the team")).toBe("About the team");
    expect(headingText("## ")).toBeNull();
  });

  it("promotes the short colon labels careers sites bold", () => {
    expect(headingText("What you'll do:")).toBe("What you'll do");
    expect(headingText("Required Skills and Experience:")).toBe("Required Skills and Experience");
  });

  it("leaves sentences, bullets and long lines alone", () => {
    expect(headingText("We are hiring engineers.")).toBeNull();
    expect(headingText("- Nice to have:")).toBeNull();
    expect(headingText("Ready to join? Here is what we are looking for in a candidate today:")).toBeNull();
    expect(headingText("You will work with teams across many many different time zones:")).toBeNull();
    expect(headingText(":")).toBeNull();
  });
});

describe("descriptionToPlainText", () => {
  it("strips markup and truncates on a word boundary with an ellipsis", () => {
    const text = "## Role\n\n- Build things\n- Ship things\n\nWe reply to everyone.";
    expect(descriptionToPlainText(text)).toBe("Role Build things Ship things We reply to everyone.");
    expect(descriptionToPlainText(text, 12)).toBe("Role Build…");
  });
});
