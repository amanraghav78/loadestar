import type { Discipline, Level } from "@/lib/generated/prisma/enums";

// ------------------------------------------------------------------ India

/** Indian cities we recognise in feed locations, mapped to the name we display. */
const CITIES: Array<[RegExp, string]> = [
  [/\b(bengaluru|bangalore)\b/i, "Bengaluru"],
  [/\bhyderabad\b/i, "Hyderabad"],
  [/\bpune\b/i, "Pune"],
  [/\b(gurugram|gurgaon)\b/i, "Gurugram"],
  [/\bnoida\b/i, "Noida"],
  [/\b(new delhi|delhi)\b/i, "Delhi"],
  [/\b(mumbai|bombay)\b/i, "Mumbai"],
  [/\b(chennai|madras)\b/i, "Chennai"],
  [/\bkolkata\b/i, "Kolkata"],
  [/\bahmedabad\b/i, "Ahmedabad"],
  [/\bjaipur\b/i, "Jaipur"],
  [/\b(kochi|cochin)\b/i, "Kochi"],
  [/\bcoimbatore\b/i, "Coimbatore"],
  [/\bindore\b/i, "Indore"],
  [/\bchandigarh\b/i, "Chandigarh"],
  [/\b(thiruvananthapuram|trivandrum)\b/i, "Thiruvananthapuram"],
];

export const INDIA_CITIES = CITIES.map(([, name]) => name);

/** Indian states/UTs: "Surat, Gujarat" is India even if Surat isn't in CITIES. */
const STATES =
  /\b(andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|orissa|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|jammu and kashmir|ladakh|puducherry)\b/i;

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export type IndiaLocation = { cities: string[]; remote: boolean };

/**
 * Looks at every location string of a posting and returns the Indian part,
 * or null when the role isn't based in India. "Remote" only counts when it is
 * explicitly Indian ("Remote - India"), never worldwide/APAC remote.
 */
export function indiaLocation(locations: string[], workplace?: "REMOTE" | "HYBRID" | "ONSITE" | null): IndiaLocation | null {
  const cities = new Set<string>();
  let remoteIndia = false;
  let mentionsIndia = false;

  for (const raw of locations) {
    // Multi-location strings use many separators: "Bengaluru • Remote, US | Pune".
    for (const part of raw.split(/\s*(?:[|•;/]|\s-\s|\bor\b)\s*/i)) {
      const p = part.trim();
      if (!p) continue;
      let hit = false;
      for (const [re, name] of CITIES) {
        if (re.test(p)) {
          cities.add(name);
          hit = true;
        }
      }
      // "Punjab" is also a Pakistani province; only trust it with a city-style "X, State" string.
      const state = STATES.exec(p);
      if (!hit && state && /,/.test(p) && !/pakistan/i.test(raw)) {
        const city = p.split(",")[0]!.trim();
        if (city && !STATES.test(city)) cities.add(titleCase(city));
        hit = true;
      }
      const saysIndia = /\bindia\b/i.test(p) || /\bIND\b/.test(p) || Boolean(state && hit);
      if (saysIndia) mentionsIndia = true;
      if (/remote/i.test(p) && (saysIndia || hit)) remoteIndia = true;
    }
    // "Remote - India" survives the split as two parts; check the whole string too.
    if (/remote[^a-z]{0,5}india|india[^a-z]{0,5}\(?remote/i.test(raw)) remoteIndia = true;
  }

  if (cities.size === 0 && !mentionsIndia) return null;
  return {
    cities: [...cities],
    remote: remoteIndia || (workplace === "REMOTE" && cities.size === 0 && mentionsIndia),
  };
}

// ------------------------------------------------------------------ discipline

// Titles we never list, even if they contain "engineer" or "product".
const EXCLUDE =
  /\b(sales|account (executive|manager|management)|business development|recruit|talent|marketing|legal|counsel|finance|accountant|payroll|customer success|support engineer|technical services? engineer|\bTSE\b|solutions? (engineer|architect|consultant)|sales engineer|customer engineer|field engineer|implementation|pre-?sales|technical account|partner (manager|marketing|enablement|development)|partnerships|operations manager|hr\b|people partner|gtm|go-to-market|client (onboarding|success|partner|director|manager)|corporate it|it (support|administrator|helpdesk)|desktop support|copywriter|video editor)/i;

const RULES: Array<[RegExp, Discipline]> = [
  [/\b(security|secops|siem|appsec|infosec|soc analyst|penetration|incident response|detection (and|&) response)\b/i, "SECURITY"],
  [/\b(site reliability|sre|devops|dev ops|infrastructure|platform engineer|cloud engineer|network engineer|database (engineer|administrator)|dba|systems engineer|reliability)\b/i, "INFRASTRUCTURE"],
  [/\b(data (scientist|science|engineer|engineering|analyst|analytics|architect)|analytics|machine learning|ml|ml ?ops|ai (engineer|researcher|scientist)|applied (ai|scientist)|research (scientist|engineer)|researcher|deep learning|nlp|computer vision)\b/i, "DATA"],
  [/\b(designer|design|ux|ui\/ux|user research(er)?|ux research(er)?)\b/i, "DESIGN"],
  [/\b(product manager|product management|product owner|product lead|head of product|director of product|vp,? product|group product|technical program manager|program manager)\b/i, "PRODUCT"],
  [/\b(engineer|engineering|developer|software|sde|swe|programmer|architect|qa|sdet|tester|test automation|mobile|android|ios|frontend|front-end|backend|back-end|full[- ]?stack)\b/i, "ENGINEERING"],
];

export function classifyDiscipline(title: string, department?: string | null): Discipline | null {
  if (EXCLUDE.test(title)) return null;
  for (const [re, d] of RULES) if (re.test(title)) return d;
  // Fall back to the department only for generic titles like "Member of Technical Staff".
  if (department && /engineering|technology|r&d/i.test(department) && /technical|staff|scientist/i.test(title)) {
    return "ENGINEERING";
  }
  return null;
}

// ------------------------------------------------------------------ level

export function classifyLevel(title: string): Level {
  const t = ` ${title} `;
  if (/\b(intern|internship|trainee|apprentice)\b/i.test(t)) return "INTERN";
  if (/\b(director|vp|vice president|head of)\b/i.test(t)) return "DIRECTOR";
  if (/\bgroup product manager\b/i.test(t)) return "MANAGER";
  if (/\bmanager\b/i.test(t) && !/\bproduct manager\b|program manager/i.test(t)) return "MANAGER";
  if (/\b(principal|distinguished|fellow)\b/i.test(t)) return "PRINCIPAL";
  if (/\bstaff\b/i.test(t)) return "STAFF";
  if (/\b(senior|sr\.?|lead)\b/i.test(t) || /\b(sde|swe|engineer|developer)[\s-]*(iii|3)\b/i.test(t)) return "SENIOR";
  if (/\b(junior|jr\.?|associate|graduate|fresher|entry[- ]level|new grad)\b/i.test(t) || /\b(sde|swe|engineer|developer)[\s-]*(i|1)\b/i.test(t)) {
    return "JUNIOR";
  }
  return "MID";
}

// ------------------------------------------------------------------ tags

const LANGS = "Java|Python|Rust|Kotlin|C\\+\\+|Scala|Node(?:\\.js)?|TypeScript|Ruby|Elixir";

// Case-sensitive on purpose: these are proper nouns, and "go"/"swift"/"rust"
// as ordinary English words would otherwise match.
const TAGS: Array<[string, RegExp]> = [
  ["Go", new RegExp(`\\bGolang\\b|(?:${LANGS})\\s*(?:,|/|or|and)\\s*Go\\b|\\bGo\\s*(?:,|/|or|and)\\s*(?:${LANGS})`)],
  ["Java", /\bJava\b/],
  ["Spring Boot", /\bSpring ?Boot\b/i],
  ["Python", /\bPython\b/],
  ["TypeScript", /\bTypeScript\b/],
  ["JavaScript", /\bJavaScript\b/],
  ["React", /\bReact(?:\.?js)?\b(?! Native)/],
  ["React Native", /\bReact Native\b/],
  ["Node.js", /\bNode(?:\.?js)\b/i],
  ["Kotlin", /\bKotlin\b/],
  ["Swift", /\bSwift(?:UI)?\b/],
  ["Android", /\bAndroid\b/],
  ["iOS", /\biOS\b/],
  ["Flutter", /\bFlutter\b/],
  ["Rust", /\bRust\b/],
  ["C++", /\bC\+\+/],
  ["Scala", /\bScala\b/],
  ["Kubernetes", /\bKubernetes\b|\bK8s\b/i],
  ["Docker", /\bDocker\b/],
  ["Terraform", /\bTerraform\b/],
  ["AWS", /\bAWS\b/],
  ["GCP", /\bGCP\b|Google Cloud/],
  ["Azure", /\bAzure\b/],
  ["Kafka", /\bKafka\b/],
  ["PostgreSQL", /\bPostgres(?:QL)?\b/],
  ["MySQL", /\bMySQL\b/],
  ["MongoDB", /\bMongoDB\b/],
  ["Redis", /\bRedis\b/],
  ["Elasticsearch", /\bElastic ?search\b/i],
  ["Spark", /\bSpark\b/],
  ["Airflow", /\bAirflow\b/],
  ["dbt", /\bdbt\b/],
  ["Snowflake", /\bSnowflake\b/],
  ["SQL", /\bSQL\b/],
  ["PyTorch", /\bPyTorch\b/],
  ["TensorFlow", /\bTensorFlow\b/],
  ["LLMs", /\bLLMs?\b|large language model/i],
  ["Microservices", /\bmicro-?services\b/i],
  ["Distributed systems", /\bdistributed systems?\b/i],
  ["Figma", /\bFigma\b/],
  ["Design systems", /\bdesign systems?\b/i],
  ["Selenium", /\bSelenium\b/],
  ["GraphQL", /\bGraphQL\b/],
];

/** Up to `max` skills, most-mentioned first; title mentions count double. */
export function extractTags(title: string, text: string, max = 6) {
  const scored: Array<[string, number]> = [];
  for (const [tag, re] of TAGS) {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    const n = (text.match(global)?.length ?? 0) + 2 * (title.match(global)?.length ?? 0);
    if (n > 0) scored.push([tag, n]);
  }
  return scored
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([tag]) => tag);
}
