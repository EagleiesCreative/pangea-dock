"use client";
import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Lock } from "lucide-react";
import { ShowProvider, useShow } from "@/lib/store";
import { StageTimer, useClock } from "@/components/live/StageTimer";
import { TimerChrome } from "@/components/live/TimerChrome";

/**
 * Stage display pinned to ONE production: /timer/<orgId>.
 * Requires sign-in (middleware) and membership of that production (enforced by /api/show).
 * Guests without an account use the guest pass instead: /share/<token>?view=timer.
 */
function TimerScreen() {
  const { show, serverNow, loaded, sync } = useShow();
  const now = useClock(serverNow);
  if (!loaded) {
    const denied = sync.state === "error" && /member|access|403|signed in/i.test(sync.error ?? "");
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0B0C10] p-6 text-center text-white/70">
        {sync.state === "error" ? (
          <div className="max-w-sm space-y-3">
            <Lock size={22} className="mx-auto text-white/40" />
            <p className="text-base font-semibold text-white">{denied ? "No access to this production" : "Can't load this timer"}</p>
            <p className="text-sm text-white/50">{denied ? "This stage timer belongs to a production you're not a member of. Ask its admin for an invite or a guest link." : sync.error}</p>
            <Link href="/" className="inline-block text-sm underline">Back to Pangea Dock</Link>
          </div>
        ) : <span className="text-sm text-white/50">Connecting…</span>}
      </div>
    );
  }
  return <StageTimer data={show} now={now} footer={<TimerChrome />} />;
}

export default function ProductionTimerPage({ params }: { params: { orgId: string } }) {
  const { isLoaded, orgId: activeOrg, orgRole } = useAuth();
  if (!isLoaded) return <div className="min-h-[100dvh] bg-[#0B0C10]" />;
  return (
    <ShowProvider key={params.orgId} orgId={params.orgId} readOnly clientRole={params.orgId === activeOrg ? orgRole ?? null : null}>
      <TimerScreen />
    </ShowProvider>
  );
}
