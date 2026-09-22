import { getSavedJobIds } from "@/lib/account-queries";
import { authEnabled } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { SavedJobsSyncClient } from "@/components/saved-jobs-sync-client";

/**
 * Reconciles the browser's saved roles with the account's. Renders nothing, and
 * reads the session, so it lives behind a <Suspense> boundary in the header.
 */
export async function SavedJobsSync() {
  if (!authEnabled) return null;
  const user = await getSessionUser();
  if (!user) return <SavedJobsSyncClient userId={null} serverIds={[]} />;
  return <SavedJobsSyncClient userId={user.id} serverIds={await getSavedJobIds()} />;
}
