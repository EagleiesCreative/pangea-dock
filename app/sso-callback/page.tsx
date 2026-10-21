"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { AlertTriangle, Loader2 } from "lucide-react";
import { clerkError } from "@/components/auth/kit";

/**
 * Google (OAuth) returns here. We finish the hand-off ourselves so a failure shows a real message
 * instead of an endless spinner, and incomplete sign-ups / 2FA are routed to our own pages.
 */
export default function SsoCallback() {
  const clerk = useClerk();
  const { isLoaded } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    ran.current = true;
    clerk
      .handleRedirectCallback(
        {
          signInUrl: "/sign-in",
          signUpUrl: "/sign-up",
          signInFallbackRedirectUrl: "/",
          signUpFallbackRedirectUrl: "/",
          continueSignUpUrl: "/sign-up?continue=1",
          secondFactorUrl: "/sign-in?resume=1",
          firstFactorUrl: "/sign-in?resume=1",
          resetPasswordUrl: "/sign-in?resume=1",
          verifyEmailAddressUrl: "/sign-up?continue=1",
        },
        (to: string) => {
          router.replace(to);
          return Promise.resolve();
        },
      )
      .catch((e: unknown) => setError(clerkError(e)));
  }, [isLoaded, clerk, router]);

  const stuck = error || slow;
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-6">
      <div className="w-full max-w-sm text-center">
        {!stuck ? (
          <div className="flex items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 size={16} className="animate-spin" /> Signing you in…</div>
        ) : (
          <div className="space-y-4">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-pgm/10 text-pgm"><AlertTriangle size={20} /></span>
            <h1 className="text-lg font-semibold text-fg">{error ? "Sign-in didn't finish" : "This is taking longer than it should"}</h1>
            <p className="text-sm text-fg-muted">
              {error
                ? error
                : isLoaded
                  ? "Google sent you back, but the session couldn't be completed. Try again — if it keeps happening, check the Google connection in your Clerk production instance."
                  : "We couldn't reach the sign-in service. Check that Clerk's production domain (clerk.<your-domain>) is verified and reachable, then try again."}
            </p>
            <div className="flex justify-center gap-2">
              <button onClick={() => window.location.replace("/sign-in")} className="inline-flex h-10 items-center rounded-xl bg-inverse px-4 text-sm font-semibold text-on-inverse hover:opacity-90">Back to sign in</button>
              <button onClick={() => window.location.reload()} className="btn !h-10 !rounded-xl">Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
