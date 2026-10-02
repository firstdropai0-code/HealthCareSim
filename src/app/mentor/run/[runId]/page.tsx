"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { RunDetail } from "@/components/runs/RunDetail";
import { useRequireBackend } from "@/lib/firebase/useAuth";

export default function MentorRunPage() {
  const params = useParams<{ runId: string }>();
  const gate = useRequireBackend("mentor");

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  return (
    <AppShell>
      <RunDetail runId={params?.runId ?? ""} viewer="mentor" />
    </AppShell>
  );
}
