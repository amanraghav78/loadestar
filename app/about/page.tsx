import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="Your next job awaits."
      intro="Lodestar is a job board for tech careers in India. Only real jobs. No spam."
    >
      <ul>
        <li>Engineering, data, product, design, security and infrastructure roles across India.</li>
        <li>Every job is open right now and was posted in the last 30 days.</li>
        <li>When a company publishes the salary, you see it first.</li>
        <li>No sign-up. Save jobs on your device and apply in one click.</li>
      </ul>
    </ContentPage>
  );
}
