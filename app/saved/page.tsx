import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SavedJobsList } from "./saved-jobs-list";

export const metadata: Metadata = {
  title: "Saved roles",
  robots: { index: false },
};

export default function SavedPage() {
  return (
    <Container wide className="py-12">
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Saved</h1>
      {/* Deliberately the same for everyone: reading the session here would pull
          the page out of the prerendered shell. */}
      <p className="mt-2 text-sm text-muted">Kept on this device, and synced to your account when you sign in.</p>
      <div className="mt-8">
        <SavedJobsList />
      </div>
    </Container>
  );
}
