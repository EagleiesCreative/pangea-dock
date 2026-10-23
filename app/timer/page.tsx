"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/** Old/short link: send the crew member to the timer of the production they have open. */
export default function TimerRedirect() {
  const { isLoaded, orgId } = useAuth();
  const router = useRouter();
  useEffect(() => { if (isLoaded && orgId) router.replace(`/timer/${orgId}`); }, [isLoaded, orgId, router]);
  if (isLoaded && !orgId)
    return <div className="grid min-h-[100dvh] place-items-center bg-[#0B0C10] text-sm text-white/60"><Link href="/" className="underline">Choose a production first</Link></div>;
  return <div className="min-h-[100dvh] bg-[#0B0C10]" />;
}
