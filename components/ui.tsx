"use client";
import React, { useEffect, useState } from "react";
import { fmtMS, parseMS } from "@/lib/time";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function Cell({
  value, onChange, mono, className, placeholder, type = "text", align, list,
}: {
  value: string | number; onChange: (v: string) => void; mono?: boolean; className?: string;
  placeholder?: string; type?: string; align?: "right" | "center"; list?: string;
}) {
  return (
    <input
      list={list}
      className={cx("cell", mono && "cell-mono", align === "right" && "text-right", align === "center" && "text-center", className)}
      value={value}
      type={type}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Area({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <textarea rows={2} className={cx("cell resize-y min-h-[44px]", className)} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
}

export function Sel<T extends string>({
  value, options, onChange, mono, className,
}: { value: T; options: readonly T[] | readonly string[]; onChange: (v: T) => void; mono?: boolean; className?: string }) {
  const opts = options.includes(value) || !value ? options : [value, ...options];
  return (
    <select className={cx("cell", mono && "cell-mono", className)} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

/** MM:SS input that only commits valid values on blur/enter. */
export function DurationCell({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => { setDraft(value); setBad(false); }, [value]);
  const commit = () => {
    const s = parseMS(draft);
    if (s == null) { setBad(true); return; }
    setBad(false);
    onChange(fmtMS(s));
  };
  return (
    <input
      className={cx("cell cell-mono w-[72px]", bad && "!border-pgm text-pgm", className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(value); setBad(false); } }}
      title="MM:SS"
    />
  );
}

export function Check({ checked, onChange, color = "accent-vid", label }: { checked: boolean; onChange: (b: boolean) => void; color?: string; label?: string }) {
  return (
    <input type="checkbox" aria-label={label} className={cx("h-4 w-4 cursor-pointer rounded", color)} checked={checked} onChange={(e) => onChange(e.target.checked)} />
  );
}

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: "red" | "green" | "cyan" | "teal" | "amber" | "violet" | "gray"; className?: string }) {
  const t = {
    red: "bg-pgm/10 text-pgm", green: "bg-pvw/10 text-pvw", cyan: "bg-vid/10 text-vid",
    teal: "bg-aud/10 text-aud", amber: "bg-cg/10 text-cg", violet: "bg-med/10 text-med",
    gray: "bg-raise text-fg-muted",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", t, className)}>{children}</span>;
}

export function IconBtn({ title, onClick, children, danger, disabled }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
      className={cx("rounded-lg p-1.5 text-fg-faint transition hover:bg-raise disabled:pointer-events-none disabled:opacity-30", danger ? "hover:text-pgm" : "hover:text-fg")}>
      {children}
    </button>
  );
}

export function Progress({ pct, color = "bg-vid" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function SectionHead({ title, accent, children, sub }: { title: string; accent?: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cx("h-2 w-2 shrink-0 rounded-full", accent ?? "bg-vid")} />
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {sub && <span className="truncate text-xs text-fg-muted">{sub}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("card overflow-x-auto", className)}>
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}
