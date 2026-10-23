"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, ListOrdered, MapPin, Radio, Timer, WifiOff } from "lucide-react";
import { computeTimes, fmtHMS, fmtMS, fmtSigned, nextPlayable, todSeconds } from "@/lib/time";
import { StageTimer, useClock, type TimerData } from "./StageTimer";
import { TimerChrome } from "./TimerChrome";
import { ThemeToggle } from "../Theme";
import { cx } from "../ui";

type Pub = TimerData & { version: number; showNotes: boolean; event: TimerData["event"] & { venue: string }; cues: (TimerData["cues"][number] & { notes?: string })[] };

/** Read-only guest pass: agenda + stage timer, no account. Polls the public endpoint. */
export function GuestView({ token, initialView }: { token: string; initialView: "agenda" | "timer" }) {
  const [data, setData] = useState<Pub | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [view, setView] = useState(initialView);
  const offset = useRef(0);
  const version = useRef(-1);
  const liveRef = useRef(false);
  const now = useCallback(() => Date.now() + offset.current, []);

  const pull = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await fetch(`/api/public/${encodeURIComponent(token)}${version.current >= 0 ? `?since=${version.current}` : ""}`, { cache: "no-store" });
      const t1 = Date.now();
      const sn = Number(res.headers.get("x-server-now"));
      if (sn) offset.current = sn - (t0 + t1) / 2;
      if (res.status === 204) { setStale(false); return; }
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "This link isn't available."); setData(null); version.current = -1; return; }
      version.current = j.version;
      liveRef.current = !!j.live?.on;
      setErr(null); setStale(false); setData(j);
    } catch { setStale(true); }
  }, [token]);

  useEffect(() => {
    pull();
    let last = 0;
    const t = setInterval(() => {
      const every = liveRef.current ? 1000 : 3000;
      if (document.hidden || Date.now() - last < every) return;
      last = Date.now();
      pull();
    }, 250);
    return () => clearInterval(t);
  }, [pull]);

  const switchView = (v: "agenda" | "timer") => {
    setView(v);
    const u = new URL(window.location.href);
    if (v === "timer") u.searchParams.set("view", "timer"); else u.searchParams.delete("view");
    window.history.replaceState(null, "", u.toString());
  };

  if (err) return (
    <div className="grid min-h-[100dvh] place-items-center bg-canvas p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-raise text-fg-muted"><WifiOff size={20} /></span>
        <h1 className="text-lg font-semibold text-fg">Link not available</h1>
        <p className="mt-1 text-sm text-fg-muted">{err} Ask the production team for a new link.</p>
      </div>
    </div>
  );
  if (!data) return <div className="grid min-h-[100dvh] place-items-center bg-canvas text-xs text-fg-muted">Loading show…</div>;

  if (view === "timer") return <GuestTimer data={data} now={now} onAgenda={() => switchView("agenda")} />;
  return <Agenda data={data} now={now} stale={stale} onTimer={() => switchView("timer")} />;
}

function GuestTimer({ data, now, onAgenda }: { data: Pub; now: () => number; onAgenda: () => void }) {
  const t = useClock(now);
  return (
    <StageTimer data={data} now={t} footer={<>
      <TimerChrome back={null} />
      <button onClick={onAgenda} className="fixed bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur hover:bg-white/20"><ListOrdered size={14} /> Agenda</button>
    </>} />
  );
}

function Agenda({ data, now, stale, onTimer }: { data: Pub; now: () => number; stale: boolean; onTimer: () => void }) {
  const t = useClock(now, 500);
  const times = computeTimes(data.cues, data.event.startTime);
  const on = data.live.on && !!data.live.startedAt;
  const idx = data.live.idx;
  const nxt = on ? nextPlayable(data.cues, idx) : -1;
  const cur = times[idx];
  const remaining = on && cur ? cur.durSec - (t - (data.live.startedAt as number)) / 1000 : null;
  const end = times.length ? times[times.length - 1].end : 0;
  const [follow, setFollow] = useState(true);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (!on || !follow || !cur) return;
    rowRefs.current[cur.cue.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [on, follow, cur?.cue.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-inverse text-on-inverse"><Radio size={15} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold text-fg">{data.event.name || "Show agenda"}</h1>
            <div className="flex items-center gap-1.5 truncate text-[11.5px] text-fg-muted">
              {data.event.venue && <><MapPin size={11} />{data.event.venue} · </>}
              <CalendarClock size={11} /> {fmtHMS(times[0]?.start ?? 0)} – {fmtHMS(end)}
              {stale && <span className="ml-1 text-cg">· reconnecting…</span>}
            </div>
          </div>
          <ThemeToggle />
          <button onClick={onTimer} className="btn !py-1.5"><Timer size={14} /> Timer</button>
        </div>
        {data.stageMsg?.text && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <div className={cx("rounded-xl px-4 py-2.5 text-sm font-semibold", data.stageMsg.tone === "urgent" ? "bg-pgm text-white" : data.stageMsg.tone === "warn" ? "bg-cg/20 text-fg" : "bg-brand-soft text-fg")}>{data.stageMsg.text}</div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="card mb-4 flex items-center gap-4 p-4">
          <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", on ? "animate-tally bg-pgm" : "bg-line-strong")} />
          <div className="min-w-0 flex-1">
            <div className={cx("text-[11px] font-semibold uppercase tracking-wider", on ? "text-pgm" : "text-fg-muted")}>{on ? "Now" : "Not started"}</div>
            <div className="truncate text-sm font-semibold text-fg">{on && cur ? cur.cue.title : `Starts at ${fmtHMS(times[0]?.start ?? 0)}`}</div>
          </div>
          {remaining != null && <div className={cx("font-mono text-2xl font-semibold tabular-nums", remaining < 0 ? "text-pgm" : remaining <= 30 ? "text-cg" : "text-fg")}>{remaining < 0 ? "+" : ""}{fmtSigned(Math.abs(Math.round(remaining)))}</div>}
        </div>

        <ol className="card divide-y divide-line overflow-hidden">
          {times.map((r, i) => {
            const isCur = on && i === idx, isNext = i === nxt, past = on && i < idx;
            const c = r.cue as Pub["cues"][number];
            if (r.isSection)
              return (
                <li key={c.id} ref={(el) => { rowRefs.current[c.id] = el; }} className={cx("flex items-center gap-3 bg-brand-soft/60 px-4 py-2.5", isCur && "!bg-pgm/10", past && "opacity-50")}>
                  <span className="w-[68px] shrink-0 font-mono text-[12.5px] font-semibold tabular-nums text-brand">{fmtHMS(r.start)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-wide text-fg">{c.title}</span>
                  <span className="font-mono text-xs text-fg-muted">{fmtMS(r.hasChildren ? r.plannedSec : r.durSec)}</span>
                </li>
              );
            return (
              <li key={c.id} ref={(el) => { rowRefs.current[c.id] = el; }} className={cx("flex gap-3 px-4 py-3", isCur && "bg-pgm/10", isNext && "bg-pvw/[0.07]", past && "opacity-50")}>
                <span className={cx("w-[68px] shrink-0 pt-px font-mono text-[12.5px] tabular-nums", isCur ? "font-semibold text-pgm" : "text-fg-soft")}>{fmtHMS(r.start)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {c.num && <span className="font-mono text-[11px] text-fg-muted">{c.num}</span>}
                    <span className="text-[13.5px] font-medium text-fg">{c.title}</span>
                    {isCur && <span className="ml-auto shrink-0 rounded-full bg-pgm px-2 py-px text-[10px] font-semibold text-white">LIVE</span>}
                    {isNext && <span className="ml-auto shrink-0 rounded-full bg-pvw/15 px-2 py-px text-[10px] font-semibold text-pvw">NEXT</span>}
                  </div>
                  {data.showNotes && c.notes && <p className="mt-0.5 whitespace-pre-line text-xs text-fg-muted">{c.notes}</p>}
                </div>
                <span className="shrink-0 pt-px font-mono text-xs text-fg-muted">{fmtMS(r.durSec)}</span>
              </li>
            );
          })}
          {!times.length && <li className="p-6 text-center text-sm text-fg-muted">No agenda yet.</li>}
        </ol>

        <div className="mt-4 flex items-center justify-between text-[11px] text-fg-faint">
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow the live item</label>
          <span>Updates live · {fmtHMS(todSeconds(new Date(t)))} · Pangea Dock</span>
        </div>
      </main>
    </div>
  );
}
