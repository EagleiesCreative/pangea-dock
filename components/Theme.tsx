"use client";
import React, { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx } from "./ui";

type Mode = "light" | "dark" | "system";
const KEY = "pangeadock.theme";

export function useTheme() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const m = localStorage.getItem(KEY) as Mode | null;
      if (m === "light" || m === "dark" || m === "system") setMode(m);
    } catch {}
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && mq.matches));
    apply();
    try { localStorage.setItem(KEY, mode); } catch {}
    if (mode !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  return [mode, setMode] as const;
}

export function ThemeToggle() {
  const [mode, setMode] = useTheme();
  const opts: { m: Mode; icon: React.ReactNode; label: string }[] = [
    { m: "light", icon: <Sun size={14} />, label: "Light" },
    { m: "dark", icon: <Moon size={14} />, label: "Dark" },
    { m: "system", icon: <Monitor size={14} />, label: "System" },
  ];
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface p-0.5" role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.m}
          role="radio"
          aria-checked={mode === o.m}
          title={`${o.label} theme`}
          onClick={() => setMode(o.m)}
          className={cx("grid h-7 w-7 place-items-center rounded-full transition", mode === o.m ? "bg-raise text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
