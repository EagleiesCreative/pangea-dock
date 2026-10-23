"use client";
import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ShowProvider, useShow } from "@/lib/store";
import { StageTimer, useClock } from "@/components/live/StageTimer";
import { TimerChrome } from "@/components/live/TimerChrome";

/** Stage display for crew members (signed in). Guests use /share/<token>?view=timer. */
function TimerScreen() {
  const { show, serverNow, ready } = useShow();
  const now = useClock(serverNow);
  if (!ready) return <div className="grid min-h-[100dvh] place-items-center bg-[#0B0C10] text-sm text-white/50">Connecting…</div>;
  return <StageTimer data={show} now={now} footer={<TimerChrome />} />;
}

export default function TimerPage() {
  const { isLoaded, orgId, orgRole } = useAuth();
  if (!isLoaded) return <div className="min-h-[100dvh] bg-[#0B0C10]" />;
  if (!orgId) return <div className="grid min-h-[100dvh] place-items-center bg-[#0B0C10] text-sm text-white/60"><Link href="/" className="underline">Choose a production first</Link></div>;
  return <ShowProvider key={orgId} clientRole={orgRole ?? null}><TimerScreen /></ShowProvider>;
}
