/**
 * Builds a minimal, uncompressed, single-page PDF containing the given lines.
 *
 * Shared by the unit test that reads a PDF and the e2e test that uploads one,
 * so both exercise a genuinely readable file. Generated rather than committed:
 * a binary fixture is one nobody can review in a diff.
 */
export function resumePdf(lines: string[]): Buffer {
  const escaped = lines.map((line) => `(${line.replace(/[\\()]/g, (c) => `\\${c}`)}) Tj T*`).join("\n");
  const content = `BT /F1 11 Tf 50 750 Td 15 TL\n${escaped}\nET\n`;

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
    `<</Length ${Buffer.byteLength(content)}>>\nstream\n${content}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/** A complete resume, in the shape people actually write them. */
export const SAMPLE_RESUME = [
  "Priya Sharma",
  "Senior Data Engineer",
  "Hyderabad, Telangana, India",
  "+91 98111 22333 | priya.sharma@gmail.com",
  "linkedin.com/in/priyasharma | github.com/priyas | priyasharma.io",
  "",
  "Summary",
  "Data engineer with 9 years of experience building pipelines in Python and Scala.",
  "Current CTC: 38 LPA",
  "Expected CTC: 50 LPA",
  "Notice period: 2 months",
  "",
  "Work Experience",
  "Senior Data Engineer, Acme Analytics - Hyderabad",
  "2020 - Present",
  "Built Spark and Airflow pipelines on AWS, landing into Snowflake.",
  "Owned the Kafka ingestion layer and the dbt models on top of it.",
  "",
  "Data Engineer, Initech - Pune",
  "2017 - 2020",
  "Wrote ETL in Python against PostgreSQL and MongoDB.",
  "",
  "Education",
  "B.Tech, Computer Science, NIT Warangal",
  "2013 - 2017",
];
