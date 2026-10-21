"use client";
import React, { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { ProductionPicker } from "@/components/workspace/ProductionPicker";

/**
 * Clerk's "choose-organization" session task lands here (see taskUrls in Providers).
 * Public route: while the session is pending, middleware treats the user as signed out.
 */
export default function SelectProduction() {
  const clerk = useClerk();
  const [state, setState] = useState<"loading" | "pick">("loading");
  useEffect(() => {
    if (!clerk.loaded) return;
    const s = clerk.session;
    if (!s) { window.location.replace("/sign-in"); return; }
    if (s.status === "active" && !s.currentTask) { window.location.replace("/"); return; }
    setState("pick");
  }, [clerk.loaded, clerk.session]);
  if (state === "loading") return <div className="grid min-h-screen place-items-center text-fg-muted"><Loader2 className="animate-spin" /></div>;
  return <ProductionPicker redirectTo="/" />;
}
