"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Radio } from "lucide-react";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { cx } from "@/components/ui";
import { ThemeToggle } from "@/components/Theme";

/* ---------------- Errors ---------------- */
export function clerkError(e: unknown): string {
  if (isClerkAPIResponseError(e)) return e.errors[0]?.longMessage || e.errors[0]?.message || "Something went wrong.";
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}
export function clerkErrorCode(e: unknown): string | undefined {
  return isClerkAPIResponseError(e) ? e.errors[0]?.code : undefined;
}

/* ---------------- Layout ---------------- */
const R = 28; // concave corner radius of the hero "bites"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Full-viewport split: form on the left, artwork filling the right edge to edge (inset 12px).
    <div className="relative grid min-h-[100dvh] bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="absolute right-4 top-4 z-20 lg:hidden"><ThemeToggle /></div>
      <section className="flex min-h-[100dvh] flex-col justify-center px-6 py-12 sm:px-14 lg:min-h-0">
        <div className="mx-auto w-full max-w-[400px]">{children}</div>
      </section>
      <div className="hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100dvh-24px)]"><Hero /></div>
      </div>
    </div>
  );
}

export function Brand() {
  return (
    <div className="mb-8 flex items-center justify-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-inverse text-on-inverse"><Radio size={19} /></span>
      <span className="text-[22px] font-semibold tracking-tight text-fg">Pangea<span className="text-brand">.</span>Dock</span>
    </div>
  );
}

export function Title({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-7 text-center">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-fg sm:text-[32px]">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-fg-muted">{sub}</p>}
    </div>
  );
}

/** Right-hand visual. Drop a photo at /public/login-hero.jpg to use it; otherwise a gradient art panel shows. */
function Hero() {
  const fillet = (pos: React.CSSProperties, at: string) => (
    <span aria-hidden className="absolute" style={{ ...pos, width: R, height: R, background: `radial-gradient(circle at ${at}, transparent ${R - 0.5}px, rgb(var(--surface)) ${R}px)` }} />
  );
  return (
    <div className="relative h-full overflow-hidden" style={{ borderRadius: `0 ${R}px 0 ${R}px` }}>
      {/* imagery */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url(/login-hero.jpg), radial-gradient(120% 90% at 85% 10%, rgb(var(--brand) / .55), transparent 55%), radial-gradient(90% 80% at 10% 100%, rgb(var(--vid) / .45), transparent 60%), linear-gradient(160deg, #1d1b3a 0%, #121226 55%, #0b0c16 100%)",
          backgroundSize: "cover, auto, auto, auto",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 opacity-[.18]" style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / .12) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .12) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/30" />

      {/* caption */}
      <p className="absolute right-10 top-10 max-w-[420px] text-right text-[22px] font-semibold leading-snug tracking-tight text-white drop-shadow">
        Run the whole show from one dock — cue sheets, camera plots and crew, live.
      </p>

      {/* floating show-control cards */}
      <div className="absolute left-1/2 top-1/2 w-[min(560px,calc(100%-80px))] -translate-x-1/2 -translate-y-1/2 space-y-3">
        <Glass>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#ffb4b4]"><span className="h-1.5 w-1.5 animate-tally rounded-full bg-[#ff7a7a]" /> ON AIR · V01</span>
            <span className="font-mono text-[11px] text-white/60">19:03:00</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-white">Opening VT / sponsor sting</div>
          <div className="mt-3 flex items-end justify-between">
            <span className="font-mono text-3xl font-semibold tracking-tight text-white">01:12</span>
            <span className="text-[11px] text-white/60">remaining</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[38%] rounded-full bg-[#ff8a8a]" /></div>
        </Glass>
        <div className="grid grid-cols-2 gap-3">
          <Glass>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#9ff0c9]"><span className="h-1.5 w-1.5 rounded-full bg-[#6fe0aa]" /> NEXT · A01</span>
            <div className="mt-1 text-[13px] font-medium text-white">Host welcome</div>
            <div className="mt-1 font-mono text-[11px] text-white/55">CAM 1 Wide</div>
          </Glass>
          <Glass>
            <span className="text-[11px] font-semibold text-white/70">Inputs</span>
            <div className="mt-2 flex gap-1.5">
              {[1, 1, 1, 1, 1, 0, 1, 2].map((s, i) => (
                <span key={i} className={cx("h-6 flex-1 rounded-md", s === 1 ? "bg-[#6fe0aa]/70" : s === 2 ? "bg-white/25" : "bg-[#ffc56b]/80")} />
              ))}
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-white/55">8 patched</div>
          </Glass>
        </div>
      </div>

      {/* concave "bites" (inverted corners) — top-left & bottom-right, like the reference */}
      <span aria-hidden className="absolute left-0 top-0 h-[92px] w-[132px] bg-surface" style={{ borderBottomRightRadius: R }} />
      {fillet({ left: 132, top: 0 }, "100% 100%")}
      {fillet({ left: 0, top: 92 }, "100% 100%")}

      <span aria-hidden className="absolute bottom-0 right-0 h-[84px] w-[200px] bg-surface" style={{ borderTopLeftRadius: R }} />
      {fillet({ right: 200, bottom: 0 }, "0% 0%")}
      {fillet({ right: 0, bottom: 84 }, "0% 0%")}

      <div className="absolute left-0 top-0 grid h-[92px] w-[132px] place-items-center"><ThemeToggle /></div>
      <div className="absolute bottom-0 right-0 flex h-[84px] w-[200px] items-center justify-end gap-2 pr-3 text-[11.5px] text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-pvw" /> Secured by Clerk
      </div>
    </div>
  );
}

function Glass({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/20 backdrop-blur-md">{children}</div>;
}

/* ---------------- Controls ---------------- */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-soft">{label}{hint}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-xl border border-line bg-raise px-4 text-[14px] text-fg outline-none transition placeholder:text-fg-faint focus:border-brand/50 focus:bg-surface focus:ring-4 focus:ring-brand/10 disabled:opacity-60";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={cx(inputCls, "pr-12", props.className)} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-fg-muted hover:bg-line/60 hover:text-fg">
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={8}
      placeholder="6-digit code"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className="text-center font-mono text-lg tracking-[0.5em]"
    />
  );
}

export function Primary({ children, loading, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button {...rest} disabled={loading || rest.disabled}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-inverse text-[14px] font-semibold text-on-inverse transition hover:opacity-90 active:translate-y-px disabled:opacity-50">
      {loading && <Loader2 size={16} className="animate-spin" />}{children}
    </button>
  );
}

export function GoogleButton({ onClick, loading, label = "Continue with Google" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface text-[14px] font-medium text-fg transition hover:bg-raise active:translate-y-px disabled:opacity-60">
      {loading ? <Loader2 size={16} className="animate-spin" /> : (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      )}
      {label}
    </button>
  );
}

export function Divider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-fg-faint">
      <span className="h-px flex-1 bg-line" />{children}<span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-xl bg-pgm/10 px-3.5 py-2.5 text-[13px] text-pgm">{children}</p>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-[13px] text-fg-soft">{children}</p>;
}

export function FootLink({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="mt-6 text-center text-sm text-fg-muted">
      {text}{" "}
      <Link href={href} className="font-semibold text-brand hover:underline">{cta}</Link>
    </p>
  );
}

export function TextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-[12.5px] font-medium text-brand hover:underline">{children}</button>;
}
