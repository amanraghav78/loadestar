/**
 * Finds an annual INR salary range in free text. Returns null unless the
 * posting clearly states one. We would rather show "Salary not disclosed"
 * than a number we misread.
 *
 * Handles "₹25,00,000 – ₹35,00,000", "INR 4,700,000—5,500,000", "Rs. 12 LPA",
 * "25-35 LPA", "₹18L – ₹24L", "30 to 45 lakhs per annum", "CTC: 1.2 Cr".
 */
export type InrBand = { min: number; max: number };

const LAKH = 100_000;
const CRORE = 10_000_000;
// Sanity limits for a full-time annual salary in rupees.
const FLOOR = 1 * LAKH;
const CEILING = 20 * CRORE;

const CUR = String.raw`(?:₹|INR|Rs\.?)`;
const NUM = String.raw`\d{1,3}(?:[,\d]*\d)?(?:\.\d+)?`;
const UNIT = String.raw`(?:\s*(?:LPA|L\b|lakhs?|lacs?|lakh|Cr\b|crores?|K\b))?`;
const SEP = String.raw`\s*(?:-|–|—|to|and)\s*`;

// "₹25,00,000 - ₹35,00,000" / "INR 20L to 30L" / "25 - 35 LPA"
const RANGE = new RegExp(
  String.raw`(${CUR})?\s*(${NUM})(${UNIT})${SEP}(${CUR})?\s*(${NUM})(${UNIT})(\s*(?:LPA|per annum|p\.?a\.?|annually|/\s*(?:year|yr|annum)|per year|INR))?`,
  "gi",
);
// Single figure, only accepted next to salary wording: "CTC of ₹18 LPA".
const SINGLE = new RegExp(String.raw`(${CUR})\s*(${NUM})(${UNIT})|(${NUM})(\s*(?:LPA))`, "gi");

const SALARY_WORDS = /(salary|ctc|compensation|pay range|pay band|base pay|remuneration|package|stipend|annual base|fixed pay|budget)/i;
const MONTHLY = /(per month|\/\s*month|monthly|p\.?m\.?\b|a month)/i;
const HOURLY = /(per hour|\/\s*h(ou)?r|hourly)/i;

function toRupees(numText: string, unitText: string, contextUnit: string) {
  const n = parseFloat(numText.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const unit = (unitText || contextUnit).trim().toLowerCase();
  if (/^(lpa|l|lakhs?|lacs?|lakh)$/.test(unit)) return n * LAKH;
  if (/^(cr|crores?)$/.test(unit)) return n * CRORE;
  if (unit === "k") return n * 1000;
  return n;
}

export function parseInrSalary(text: string): InrBand | null {
  const flat = text.replace(/\s+/g, " ");

  for (const m of flat.matchAll(RANGE)) {
    const [whole, cur1, n1, u1, cur2, n2, u2, suffix = ""] = m;
    const at = m.index ?? 0;
    const before = flat.slice(Math.max(0, at - 160), at);
    const after = flat.slice(at + whole.length, at + whole.length + 40);

    const hasCurrency = Boolean(cur1 || cur2 || /INR/i.test(suffix) || /(₹|INR|Rs\.?)\s*$/.test(before));
    const hasLakhUnit = /l|lakh|lac|cr|crore/i.test(`${u1}${u2}${suffix}`);
    // A bare "25 - 35" is only a salary with a rupee marker or a lakh/crore unit.
    if (!hasCurrency && !hasLakhUnit) continue;
    // Guard against "₹10 crore in payments" / "10 crore users": the range must
    // sit next to salary wording ("salary", "CTC", "pay range", ...).
    if (!SALARY_WORDS.test(before)) continue;
    if (MONTHLY.test(`${suffix}${after}`) || HOURLY.test(`${suffix}${after}`)) continue;

    // "25 - 35 LPA": the unit written once applies to both numbers.
    const shared = (u2 || u1 || (/LPA/i.test(suffix) ? "LPA" : "")).trim();
    const min = toRupees(n1!, u1!, shared);
    const max = toRupees(n2!, u2!, shared);
    const band = sane(min, max);
    if (band) return band;
  }

  for (const m of flat.matchAll(SINGLE)) {
    const at = m.index ?? 0;
    const before = flat.slice(Math.max(0, at - 120), at);
    if (!SALARY_WORDS.test(before)) continue;
    const after = flat.slice(at + m[0].length, at + m[0].length + 30);
    if (MONTHLY.test(after) || HOURLY.test(after)) continue;
    const value = m[2] ? toRupees(m[2], m[3] ?? "", "") : toRupees(m[4]!, "LPA", "");
    const band = sane(value, value);
    if (band) return band;
  }

  return null;
}

function sane(min: number | null, max: number | null): InrBand | null {
  if (min == null || max == null) return null;
  const lo = Math.round(Math.min(min, max));
  const hi = Math.round(Math.max(min, max));
  if (lo < FLOOR || hi > CEILING) return null;
  // A "range" spanning more than 5x is almost always two unrelated numbers.
  if (hi > lo * 5) return null;
  return { min: lo, max: hi };
}
