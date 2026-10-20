"use client";
import React, { useEffect, useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

/** ClerkProvider whose look follows the app's light/dark class on <html>. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setIsDark(el.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return (
    <ClerkProvider
      afterSignOutUrl="/sign-in"
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          colorPrimary: isDark ? "#A28EF2" : "#6A54CD",
          colorBackground: isDark ? "#16171D" : "#FFFFFF",
          borderRadius: "0.75rem",
          fontFamily: "Inter, ui-sans-serif, system-ui, Helvetica, Arial, sans-serif",
        },
        elements: {
          card: "shadow-none border border-line",
          organizationSwitcherTrigger: "w-full justify-between rounded-xl px-2 py-1.5 hover:bg-raise",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
