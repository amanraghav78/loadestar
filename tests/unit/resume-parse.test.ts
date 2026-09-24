import { describe, expect, it } from "vitest";
import { countSuggestions, parseInrAmount, parseResumeText } from "@/lib/resume-parse";

/**
 * The parser guesses, so these tests are written against the shapes real
 * resumes actually take. What matters most is the second half of the file: a
 * wrong guess is worse than no guess, because the candidate has to notice it
 * and undo it.
 */

const NOW = new Date("2026-09-25T00:00:00Z");

const RESUME = `Aman Raghav
Senior Backend Engineer
Bengaluru, Karnataka, India
+91 98765 43210 | aman.raghav@gmail.com
linkedin.com/in/amanraghav | github.com/amanraghav | amanraghav.dev

Summary
Backend engineer with 7 years of experience building distributed systems in Python and Go.
Current CTC: 32 LPA
Expected CTC: 45 LPA
Notice period: 60 days

Work Experience
Senior Backend Engineer, Acme Payments — Bengaluru
2021 - Present
Designed a Kafka pipeline on AWS, deployed with Kubernetes and Terraform.
Migrated the billing service to PostgreSQL and Redis.

Backend Engineer, Initech — Pune
2019 - 2021
Built internal services in Python and Django.

Education
B.Tech, Computer Science, IIT Delhi
2015 - 2019

Skills
Python, Go, Kubernetes, Docker, AWS, PostgreSQL, Kafka, Terraform, Redis
`;

describe("parseResumeText, on a typical resume", () => {
  const parsed = parseResumeText(RESUME, NOW);

  it("reads the name from the top of the page", () => {
    expect(parsed.fullName).toBe("Aman Raghav");
  });

  it("reads the headline as the current title, not the first job entry", () => {
    expect(parsed.currentTitle).toBe("Senior Backend Engineer");
  });

  it("reads an Indian mobile number", () => {
    expect(parsed.phone).toBe("+919876543210");
  });

  it("reads the city under the name we display it by", () => {
    expect(parsed.city).toBe("Bengaluru");
  });

  it("prefers the stated years of experience", () => {
    expect(parsed.yearsExperience).toBe(7);
  });

  it("reads the profile links, and the personal site separately", () => {
    expect(parsed.linkedinUrl).toBe("https://linkedin.com/in/amanraghav");
    expect(parsed.githubUrl).toBe("https://github.com/amanraghav");
    expect(parsed.portfolioUrl).toBe("https://amanraghav.dev");
  });

  it("reads both salary figures, in rupees", () => {
    expect(parsed.currentSalary).toBe(3_200_000);
    expect(parsed.expectedSalary).toBe(4_500_000);
  });

  it("reads the notice period in days", () => {
    expect(parsed.noticePeriod).toBe(60);
  });

  it("reads skills in the vocabulary jobs are tagged with", () => {
    expect(parsed.skills).toEqual(expect.arrayContaining(["Python", "Kubernetes", "AWS", "Kafka", "PostgreSQL"]));
  });

  it("never returns the candidate's email address", () => {
    // We already have their email from Google, and it isn't a profile field.
    expect(JSON.stringify(parsed)).not.toContain("aman.raghav@gmail.com");
  });
});

describe("parseResumeText is careful about what it does not know", () => {
  it("leaves out fields it cannot find rather than guessing blanks", () => {
    const parsed = parseResumeText("Worked on some things.\n".repeat(20), NOW);
    expect(parsed.fullName).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
    expect(parsed.currentSalary).toBeUndefined();
    expect(parsed.skills).toEqual([]);
    expect(countSuggestions(parsed)).toBe(0);
  });

  it("does not read a section heading or a job title as a name", () => {
    const parsed = parseResumeText("CURRICULUM VITAE\nSoftware Engineer\nPune, India\n", NOW);
    expect(parsed.fullName).toBeUndefined();
  });

  it("normalises a shouted name", () => {
    expect(parseResumeText("PRIYA SHARMA\nProduct Designer\n", NOW).fullName).toBe("Priya Sharma");
  });

  it("does not read a year range or a PIN code as a phone number", () => {
    expect(parseResumeText("Experience\n2019 - 2023\nMumbai 400001\n", NOW).phone).toBeUndefined();
  });

  it("does not count a degree start date as work experience", () => {
    const resume = `Ravi Kumar
Work Experience
Engineer, Acme
2022 - Present

Education
B.Tech, 2014 - 2018
`;
    // Four years since 2022, not twelve since 2014.
    expect(parseResumeText(resume, NOW).yearsExperience).toBe(4);
  });

  it("infers nothing from experience when there is no work-history section", () => {
    expect(parseResumeText("Education\nB.Tech 2010 - 2014\n", NOW).yearsExperience).toBeUndefined();
  });

  it("ignores a bare linkedin.com with no profile on it", () => {
    expect(parseResumeText("Contact\nlinkedin.com\ngithub.com\n", NOW).linkedinUrl).toBeUndefined();
  });

  it("does not offer a mail provider as a portfolio", () => {
    expect(parseResumeText("Reach me at someone@gmail.com\n", NOW).portfolioUrl).toBeUndefined();
  });

  it.each([
    ["a JavaScript library", "Skills\nNode.js, React.js, Express.js"],
    ["a .NET stack", "Skills\nASP.NET, C#, vb.net"],
    ["a certificate badge", "Certifications\nAWS Certified - credly.com/badges/123"],
    ["a puzzle site", "Links\nleetcode.com/u/someone hackerrank.com/someone"],
    ["an employer mentioned in the work history", "Priya Sharma\nBengaluru\n\nExperience\nEngineer at Acme (acme.com)"],
  ])("does not mistake %s for the candidate's own site", (_label, text) => {
    expect(parseResumeText(text, NOW).portfolioUrl).toBeUndefined();
  });

  it("takes the personal site out of the contact block", () => {
    const resume = `Priya Sharma
Bengaluru, India
+91 98765 43210 | priya@gmail.com
linkedin.com/in/priyas | github.com/priyas | priyasharma.dev

Experience
Engineer at Acme (acme.com)
`;
    expect(parseResumeText(resume, NOW).portfolioUrl).toBe("https://priyasharma.dev");
  });
});

describe("skills, on the stacks people actually list", () => {
  it.each([
    ["a Java stack", "Skills\nJava, Spring Boot, Hibernate, Jenkins, Maven, JUnit, SQL Server", ["Java", "Spring Boot", "Hibernate", "Jenkins", "Maven", "JUnit", "SQL Server"]],
    ["a JavaScript stack", "Skills\nNode.js, Express, Angular, Vue.js, Next.js, Redux, Tailwind CSS", ["Node.js", "Express", "Angular", "Vue", "Next.js", "Redux", "Tailwind CSS"]],
    ["a Python data stack", "Skills\nPython, Pandas, NumPy, scikit-learn, Hadoop, Hive, Tableau, Power BI", ["Python", "Pandas", "NumPy", "scikit-learn", "Hadoop", "Hive", "Tableau", "Power BI"]],
    ["a .NET stack", "Skills\nC#, ASP.NET, SQL Server, Azure", ["C#", ".NET", "SQL Server", "Azure"]],
    ["an infrastructure stack", "Skills\nKubernetes, Terraform, Ansible, Grafana, Prometheus, Nginx, Linux", ["Kubernetes", "Terraform", "Ansible", "Grafana", "Prometheus", "Nginx", "Linux"]],
  ])("reads %s in full", (_label, text, expected) => {
    expect(parseResumeText(text, NOW).skills).toEqual(expect.arrayContaining(expected));
  });

  it("reads PostgreSQL however it is spelled", () => {
    for (const spelling of ["PostgreSQL", "Postgres", "postgresql"]) {
      expect(parseResumeText(`Skills\n${spelling}`, NOW).skills).toContain("PostgreSQL");
    }
  });

  it("keeps the list short enough to stay editable", () => {
    const everything = "Skills\nJava, Python, Go, Rust, Kotlin, Swift, React, Angular, Vue, Next.js, Redux, Django, Flask, FastAPI, Express, Hibernate, Spring Boot, Laravel, Rails, Jenkins, Ansible, Grafana, Prometheus, Nginx, Linux, Docker, Kubernetes, Terraform, AWS, GCP, Azure, Kafka, Redis, MongoDB, Cassandra, Snowflake, Tableau, Hadoop, Hive, Spark, Airflow, Maven, Gradle, JUnit, Jest, Cypress";
    expect(parseResumeText(everything, NOW).skills.length).toBeLessThanOrEqual(30);
  });

  it("caps the text it will read, so a huge PDF can't stall the upload", () => {
    const parsed = parseResumeText(`${"filler ".repeat(200_000)}Notice period: 30 days`, NOW);
    expect(parsed.noticePeriod).toBeUndefined();
  });
});

describe("notice period", () => {
  it.each([
    ["Notice period: 90 days", 90],
    ["Notice Period - 2 months", 60],
    ["notice period: 4 weeks", 28],
    ["Notice period: Immediate", 0],
    ["Immediate joiner", 0],
    ["Available immediately", 0],
  ])("reads %s", (text, expected) => {
    expect(parseResumeText(text, NOW).noticePeriod).toBe(expected);
  });

  it("rejects a notice period longer than anyone serves", () => {
    expect(parseResumeText("Notice period: 400 days", NOW).noticePeriod).toBeUndefined();
  });
});

describe("parseInrAmount", () => {
  it.each([
    ["18 LPA", 1_800_000],
    ["18", 1_800_000],
    ["24.5 lakhs", 2_450_000],
    ["12 lacs", 1_200_000],
    ["₹18,00,000", 1_800_000],
    ["1800000", 1_800_000],
    ["1.2 Cr", 12_000_000],
    ["INR 45 LPA", 4_500_000],
    ["Rs. 30 LPA", 3_000_000],
  ])("reads %s as rupees per year", (input, expected) => {
    expect(parseInrAmount(input)).toBe(expected);
  });

  it.each([["nonsense"], [""], ["0"], ["999999999999"], ["50%"]])("returns null for %s", (input) => {
    expect(parseInrAmount(input)).toBeNull();
  });
});
