"use client";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

// Google (OAuth) returns here; Clerk finishes the session and redirects onward.
export default function Page() {
  return (
    <div className="grid min-h-screen place-items-center text-fg-muted">
      <div className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Signing you in…</div>
      <AuthenticateWithRedirectCallback signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />
    </div>
  );
}
