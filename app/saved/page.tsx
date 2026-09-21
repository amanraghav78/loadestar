import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SavedJobsList } from "./saved-jobs-list";

export const metadata: Metadata = {
  title: "Saved roles",
  robots: { index: false },
};

export default function SavedPage() {
  return (
    <Container className="py-10">
      <h1 className="metal-text text-2xl font-semibold tracking-tight">Saved roles</h1>
      <p className="mt-2 text-sm text-muted">
        Saved on this device only. There&rsquo;s no account; clearing your browser data clears this list.
      </p>
      <div className="mt-8">
        <SavedJobsList />
      </div>
    </Container>
  );
}
