import type { JobSource } from "@/lib/generated/prisma/enums";

export type SourceCompany = {
  slug: string;
  name: string;
  website: string;
  atsSource: Exclude<JobSource, "MANUAL">;
  atsToken: string;
};

/**
 * Companies with India offices that publish a public job-board feed. The sync
 * creates each one on first run; after that, the Company row in the database
 * is the source of truth (add or disable feeds from /admin/companies).
 *
 * Every token here was verified against the live feed.
 */
export const BOOTSTRAP_COMPANIES: SourceCompany[] = [
  // Greenhouse
  { slug: "airbnb", name: "Airbnb", website: "https://www.airbnb.com", atsSource: "GREENHOUSE", atsToken: "airbnb" },
  { slug: "cloudflare", name: "Cloudflare", website: "https://www.cloudflare.com", atsSource: "GREENHOUSE", atsToken: "cloudflare" },
  { slug: "coinbase", name: "Coinbase", website: "https://www.coinbase.com", atsSource: "GREENHOUSE", atsToken: "coinbase" },
  { slug: "databricks", name: "Databricks", website: "https://www.databricks.com", atsSource: "GREENHOUSE", atsToken: "databricks" },
  { slug: "datadog", name: "Datadog", website: "https://www.datadoghq.com", atsSource: "GREENHOUSE", atsToken: "datadog" },
  { slug: "druva", name: "Druva", website: "https://www.druva.com", atsSource: "GREENHOUSE", atsToken: "druva" },
  { slug: "elastic", name: "Elastic", website: "https://www.elastic.co", atsSource: "GREENHOUSE", atsToken: "elastic" },
  { slug: "gitlab", name: "GitLab", website: "https://about.gitlab.com", atsSource: "GREENHOUSE", atsToken: "gitlab" },
  { slug: "groww", name: "Groww", website: "https://groww.in", atsSource: "GREENHOUSE", atsToken: "groww" },
  { slug: "inmobi", name: "InMobi", website: "https://www.inmobi.com", atsSource: "GREENHOUSE", atsToken: "inmobi" },
  { slug: "mongodb", name: "MongoDB", website: "https://www.mongodb.com", atsSource: "GREENHOUSE", atsToken: "mongodb" },
  { slug: "okta", name: "Okta", website: "https://www.okta.com", atsSource: "GREENHOUSE", atsToken: "okta" },
  { slug: "rubrik", name: "Rubrik", website: "https://www.rubrik.com", atsSource: "GREENHOUSE", atsToken: "rubrik" },
  { slug: "samsara", name: "Samsara", website: "https://www.samsara.com", atsSource: "GREENHOUSE", atsToken: "samsara" },
  { slug: "stripe", name: "Stripe", website: "https://stripe.com", atsSource: "GREENHOUSE", atsToken: "stripe" },
  { slug: "twilio", name: "Twilio", website: "https://www.twilio.com", atsSource: "GREENHOUSE", atsToken: "twilio" },
  // Lever
  { slug: "cred", name: "CRED", website: "https://cred.club", atsSource: "LEVER", atsToken: "cred" },
  { slug: "fampay", name: "FamPay", website: "https://famapp.in", atsSource: "LEVER", atsToken: "fampay" },
  { slug: "meesho", name: "Meesho", website: "https://www.meesho.com", atsSource: "LEVER", atsToken: "meesho" },
  { slug: "mindtickle", name: "Mindtickle", website: "https://www.mindtickle.com", atsSource: "LEVER", atsToken: "mindtickle" },
  { slug: "paytm", name: "Paytm", website: "https://paytm.com", atsSource: "LEVER", atsToken: "paytm" },
  { slug: "zeta", name: "Zeta", website: "https://www.zeta.tech", atsSource: "LEVER", atsToken: "zeta" },
  // Ashby
  { slug: "atlan", name: "Atlan", website: "https://atlan.com", atsSource: "ASHBY", atsToken: "atlan" },
  { slug: "confluent", name: "Confluent", website: "https://www.confluent.io", atsSource: "ASHBY", atsToken: "confluent" },
  { slug: "sarvam", name: "Sarvam AI", website: "https://www.sarvam.ai", atsSource: "ASHBY", atsToken: "sarvam" },
];
