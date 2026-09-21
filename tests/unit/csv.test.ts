import { describe, expect, it } from "vitest";
import { csvToRecords, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines in fields", () => {
    const csv = 'a,b,c\r\n1,"two, with comma","say ""hi""\nsecond line"\n';
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "two, with comma", 'say "hi"\nsecond line'],
    ]);
  });

  it("skips blank lines and strips a BOM", () => {
    expect(parseCsv("﻿x,y\n\n1,2\n")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });
});

describe("csvToRecords", () => {
  it("keys rows by lowercased header", () => {
    expect(csvToRecords("Company_Slug, Title\narclight, Engineer ")).toEqual([{ company_slug: "arclight", title: "Engineer" }]);
  });
});
