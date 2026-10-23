"use client";
import React, { useEffect, useState } from "react";
import { computeTimes, fmtHMS, fmtLen, fmtSigned, nextPlayable, todSeconds, wrapDiff } from "@/lib/time";
import type { StageMsg } from "@/lib/types";

export type TimerCue = { id: string; kind?: string; num: string; dur: string; title: string };
export interface TimerData {
  event: { name: string; startTime: string };
  cues: TimerCue[];
  live: { on: boolean; idx: number; startedAt: number | null };
  stageMsg: StageMsg | null;
}

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/** Ticks with the server-aligned clock so every screen agrees. */
export function useClock(now: () => number, ms = 200) {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const i = setInterval(() => setT(now()), ms);
    return () => clearInterval(i);
  }, [now, ms]);
  return t;
}

const fmtCount = (sec: number) => {
  const a = Math.abs(sec);
  const s = a < 1 && sec < 0 ? 1 : Math.floor(a + (sec >= 0 ? 0.999 : 0)); // count down to 0:00 then up
  const h = Math.floor(s / 3600);
  const body = h ? `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : fmtSigned(s);
  return (sec < 0 ? "+" : "") + body;
};
const fmtVar = (sec: number) => (Math.abs(sec) < 1 ? "On time" : `${sec > 0 ? "+" : "−"}${fmtLen(sec)} ${sec > 0 ? "behind" : "ahead"}`);

/**
 * Presenter / stage display: big countdown for the cue on air, what's next, and stage messages.
 * Always dark, high contrast — it lives on a confidence monitor or a phone on the lectern.
 */
export function StageTimer({ data, now, footer }: { data: TimerData; now: number; footer?: React.ReactNode }) {
  const { event, cues, live, stageMsg } = data;
  const times = computeTimes(cues, event.startTime);
  const idx = Math.min(Math.max(live.idx, 0), Math.max(times.length - 1, 0));
  const cur = times[idx];
  const nxt = times[nextPlayable(cues, idx)];
  const on = live.on && !!live.startedAt;
  const elapsed = on ? (now - (live.startedAt as number)) / 1000 : 0;
  const remaining = cur ? (on ? cur.durSec - elapsed : cur.durSec) : 0;
  const pct = on && cur?.durSec ? Math.min(100, (elapsed / cur.durSec) * 100) : 0;
  const variance = on && cur ? wrapDiff(todSeconds(new Date(live.startedAt as number)) - cur.start) + Math.max(0, -remaining) : null;
  const tone = !on ? "idle" : remaining < 0 ? "over" : remaining <= 30 ? "warn" : "ok";
  const msgTone = stageMsg?.tone ?? "info";

  return (
    <div className={cx("relative flex min-h-[100dvh] w-full select-none flex-col bg-[#0B0C10] text-white", !!footer && "max-sm:pb-14")}>
      {/* top strip */}
      <div className="flex items-center justify-between gap-4 px-[3vw] pt-[2.2vh] text-[clamp(13px,1.6vw,22px)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cx("h-3 w-3 shrink-0 rounded-full", on ? "animate-tally bg-[#F2555A]" : "bg-white/25")} />
          <span className={cx("font-semibold tracking-wide", on ? "text-[#F2555A]" : "text-white/55")}>{on ? "ON AIR" : "STANDBY"}</span>
          <span className="truncate text-white/50">{event.name}</span>
        </div>
        <span className="font-mono tabular-nums text-white/70">{fmtHMS(todSeconds(new Date(now)))}</span>
      </div>

      {/* current cue */}
      <div className="px-[3vw] pt-[3vh]">
        <div className="flex items-baseline gap-4 text-[clamp(16px,2.4vw,40px)] font-semibold leading-tight">
          {cur?.cue.num && <span className="font-mono text-white/45">{cur.cue.num}</span>}
          <span className="truncate">{cur?.cue.title ?? "No cues"}</span>
        </div>
      </div>

      {/* countdown */}
      <div className="flex flex-1 flex-col items-center justify-center px-[3vw]">
        <div
          className={cx(
            "font-mono font-semibold leading-none tabular-nums tracking-tight",
            tone === "over" ? "text-[#F2555A]" : tone === "warn" ? "text-[#F2B544]" : tone === "idle" ? "text-white/60" : "text-white",
          )}
          style={{ fontSize: "clamp(88px, 21vw, 420px)" }}
          aria-live="off"
        >
          {cur ? fmtCount(remaining) : "--:--"}
        </div>
        <div className="mt-[2.5vh] h-[clamp(6px,0.9vh,12px)] w-full max-w-[80vw] overflow-hidden rounded-full bg-white/10">
          <div className={cx("h-full rounded-full transition-[width] duration-200", tone === "over" ? "bg-[#F2555A]" : tone === "warn" ? "bg-[#F2B544]" : "bg-white/80")} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-[1.5vh] text-[clamp(14px,1.8vw,28px)] text-white/55">
          {!on ? "Waiting for the show to start" : tone === "over" ? "Over time" : variance == null ? "" : fmtVar(variance)}
        </div>
      </div>

      {/* stage message */}
      {stageMsg?.text && (
        <div
          className={cx(
            "mx-[3vw] mb-[2vh] rounded-[2vw] px-[3vw] py-[2.5vh] text-center font-bold leading-tight",
            msgTone === "urgent" ? "bg-[#E5484D] text-white" : msgTone === "warn" ? "bg-[#F2B544] text-[#1A1300]" : "bg-white text-[#0B0C10]",
            stageMsg.flash && "animate-[stageflash_1s_steps(2,start)_infinite]",
          )}
          style={{ fontSize: "clamp(28px, 6vw, 120px)" }}
          role="status"
        >
          {stageMsg.text}
        </div>
      )}

      {/* next */}
      <div className="flex items-center justify-between gap-4 border-t border-white/10 px-[3vw] py-[2vh] text-[clamp(14px,2vw,32px)]">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 text-[0.7em] font-semibold uppercase tracking-[0.18em] text-[#3DD68C]">Next</span>
          {nxt ? (<>
            {nxt.cue.num && <span className="font-mono text-white/45">{nxt.cue.num}</span>}
            <span className="truncate font-medium text-white/85">{nxt.cue.title}</span>
          </>) : <span className="text-white/50">End of show</span>}
        </div>
        {nxt && <span className="shrink-0 font-mono tabular-nums text-white/50">{fmtSigned(nxt.durSec)}</span>}
      </div>
      {footer}
    </div>
  );
}
