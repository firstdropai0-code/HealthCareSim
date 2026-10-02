"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { RunDetail } from "@/components/runs/RunDetail";
import { useRequireBackend } from "@/lib/firebase/useAuth";

/**
 * A trainee's own past run, reopened from My Progress.
 *
 * Before this existed the report was shown once, on /feedback, from a
 * localStorage copy that starting the next case erases — while the mentor could
 * reopen the very same run for as long as they liked. The run, its report and
 * its transcript were already in Firestore and already readable by their owner;
 * only the page was missing, so this needs no rules or schema change.
 *
 * Trainee-only because "back" leads to /progress, which is. A mentor reads a
 * run at /mentor/run/[runId].
 */
export default function OwnRunPage() {
  const params = useParams<{ runId: string }>();
  const gate = useRequireBackend("trainee");

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  return (
    <AppShell>
      <RunDetail runId={params?.runId ?? ""} viewer="owner" />
    </AppShell>
  );
}
