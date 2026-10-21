"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, CloudOff, Download, Eye, Loader2, MapPin, Play, Printer, RotateCcw, Timer, Upload, Check as CheckIcon } from "lucide-react";
import { CrewControls } from "./Crew";
import { useShow } from "@/lib/store";
import { computeTimes, fmtHMS, fmtSigned, todSeconds, wrapDiff } from "@/lib/time";
import { download, productionBookCsv, slug } from "@/lib/export";
import { ThemeToggle } from "./Theme";
import { Progress, cx } from "./ui";
import type { Format, Show } from "@/lib/types";

function useNow(ms = 250) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** ±M:SS under an hour, ±H:MM:SS above. */
function fmtVariance(sec: number) {
  const a = Math.round(Math.abs(sec));
  const sign = sec > 0.5 ? "+" : sec < -0.5 ? "−" : "";
  if (a < 3600) return sign + fmtSigned(a);
  const h = Math.floor(a / 3600);
  return `${sign}${h}:${fmtSigned(a % 3600)}`;
}

export function Header({ onPrint }: { onPrint: () => void }) {
  const { show, patchEvent, setLive, go, prev, resetTimer, replaceAll, reset, canEdit, sync } = useShow();
  const now = useNow();
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);

  const times = computeTimes(show.cues, show.event.startTime);
  const idx = Math.min(show.live.idx, Math.max(times.length - 1, 0));
  const active = times[idx];
  const next = times[idx + 1];
  const live = show.live.on;
  const elapsed = live && show.live.startedAt ? (now - show.live.startedAt) / 1000 : 0;
  const remaining = active ? active.durSec - elapsed : 0;
  const pct = active && live && active.durSec ? (elapsed / active.durSec) * 100 : 0;

  let variance: number | null = null;
  if (live && show.live.startedAt && active) {
    const actualStart = todSeconds(new Date(show.live.startedAt));
    variance = wrapDiff(actualStart - active.start) + Math.max(0, -remaining);
  }

  const cdColor = !live ? "text-fg" : remaining < 0 ? "text-pgm animate-pulse" : remaining <= 30 ? "text-cg" : "text-fg";
  const vColor = variance == null ? "text-fg-faint" : variance > 0.5 ? "text-pgm" : "text-pvw";

  const exportJson = () => download(`${slug(show.event.name)}-production-book.json`, JSON.stringify(show, null, 2), "application/json");
  const exportCsv = () => download(`${slug(show.event.name)}-production-book.csv`, productionBookCsv(show), "text/csv");
  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as Show;
      if (!parsed.cues || !parsed.event) throw new Error("Not a Pangea Dock file");
      replaceAll(parsed);
    } catch (e) {
      window.alert("Import failed: " + (e instanceof Error ? e.message : "invalid JSON"));
    }
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
      {/* Row 1 — event + global actions */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3 lg:px-6">
        <div className="min-w-[240px] flex-1">
          <input
            className="w-full rounded-md bg-transparent text-lg font-semibold tracking-tight text-fg outline-none placeholder:text-fg-faint focus:bg-surface"
            readOnly={!canEdit}
            value={show.event.name}
            onChange={(e) => patchEvent({ name: e.target.value })}
            placeholder="Event name"
            aria-label="Event name"
          />
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <SyncPill state={sync.state} by={sync.updatedBy} canEdit={canEdit} error={sync.error} />
            <MapPin size={12} className="shrink-0" />
            <input className="min-w-0 flex-1 rounded bg-transparent outline-none placeholder:text-fg-faint focus:bg-surface" readOnly={!canEdit} value={show.event.venue} onChange={(e) => patchEvent({ venue: e.target.value })} placeholder="Venue" aria-label="Venue" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative inline-flex items-center">
            <select
              className="appearance-none rounded-full border border-line bg-surface py-1.5 pl-3 pr-7 font-mono text-xs font-medium text-fg outline-none hover:bg-raise focus:ring-2 focus:ring-brand/20"
              disabled={!canEdit}
              value={show.event.format}
              onChange={(e) => patchEvent({ format: e.target.value as Format })}
              aria-label="Master target format"
            >
              <option>1080p50</option>
              <option>1080p59.94</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-fg-muted" />
          </label>

          <ThemeToggle />

          <div className="relative">
            <button className="btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}><Download size={14} /> Export <ChevronDown size={13} className="text-fg-muted" /></button>
            {menu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/5" onMouseLeave={() => setMenu(false)}>
                <MenuItem icon={<Download size={14} />} onClick={() => { exportJson(); setMenu(false); }}>Production book · JSON</MenuItem>
                <MenuItem icon={<Download size={14} />} onClick={() => { exportCsv(); setMenu(false); }}>Production book · CSV</MenuItem>
                <MenuItem icon={<Printer size={14} />} onClick={() => { setMenu(false); onPrint(); }}>Print / PDF view</MenuItem>
                {canEdit && <div className="my-1 h-px bg-line" />}
                {canEdit && <MenuItem icon={<Upload size={14} />} onClick={() => { fileRef.current?.click(); setMenu(false); }}>Import JSON…</MenuItem>}
                {canEdit && <MenuItem icon={<RotateCcw size={14} />} danger onClick={() => { setMenu(false); if (window.confirm("Reset everything to the demo dataset? Your edits will be lost.")) reset(); }}>Reset to demo data</MenuItem>}
              </div>
            )}
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={live}
            disabled={!canEdit}
            onClick={() => setLive(!live)}
            className={cx("inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60", live ? "border-pgm/30 bg-pgm/10 text-pgm" : "border-line bg-surface text-fg hover:bg-raise")}
          >
            <span className={cx("relative h-5 w-9 rounded-full transition", live ? "bg-pgm" : "bg-line-strong")}>
              <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all", live ? "left-[18px]" : "left-0.5")} />
            </span>
            Live show mode
          </button>
          <div className="lg:hidden"><CrewControls compact /></div>
        </div>
      </div>

      {/* Row 2 — show control strip */}
      <div className="px-4 pb-3 pt-3 lg:px-6">
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <div className="min-w-[200px] flex-[1.4]">
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-fg-muted">
              <span className={cx("h-2 w-2 rounded-full", live ? "animate-tally bg-pgm" : "bg-line-strong")} />
              <span className={live ? "text-pgm" : ""}>{live ? "On air" : "Standby"}</span>
              {active && <span className="font-mono text-fg-soft">{active.cue.num}</span>}
            </div>
            <div className="truncate text-sm font-semibold text-fg">{active?.cue.title ?? "No cues"}</div>
            <div className="mt-2"><Progress pct={pct} color={remaining < 0 ? "bg-pgm" : remaining <= 30 && live ? "bg-cg" : "bg-pgm/70"} /></div>
          </div>

          <div className="hidden min-w-[160px] flex-1 border-l border-line pl-6 md:block">
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-fg-muted">
              <span className="h-2 w-2 rounded-full bg-pvw" /> Next {next && <span className="font-mono text-fg-soft">{next.cue.num}</span>}
            </div>
            <div className="truncate text-sm font-medium text-fg-soft">{next?.cue.title ?? "End of show"}</div>
            <div className="mt-1 font-mono text-[11px] text-fg-faint">{next ? `@ ${fmtHMS(next.start)}` : ""}</div>
          </div>

          <Tele label="Time of day" value={fmtHMS(todSeconds(new Date(now)))} />
          <Tele label={live ? "Remaining" : "Duration"} value={active ? fmtSigned(live ? remaining : active.durSec) : "--:--"} valueClass={cdColor} />
          <Tele
            label="Over / under"
            value={variance == null ? "--:--" : fmtVariance(variance)}
            valueClass={vColor}
            sub={variance == null ? "Not live" : variance > 0.5 ? "Behind" : variance < -0.5 ? "Ahead" : "On time"}
          />

          <div className="flex items-center gap-2 lg:ml-auto">
            <button className="btn !px-2.5" onClick={prev} disabled={!canEdit || (!live && show.live.idx === 0)} title="Previous cue"><ChevronLeft size={15} /><span className="hidden xl:inline">Prev</span></button>
            <button
              onClick={go}
              disabled={!live || !canEdit}
              title="Take next cue (Spacebar)"
              className="inline-flex items-center gap-2 rounded-full bg-pgm px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 active:translate-y-px disabled:pointer-events-none disabled:bg-line-strong disabled:text-fg-muted"
            >
              <Play size={13} fill="currentColor" /> Go / take next
              <kbd className="rounded-md bg-black/15 px-1.5 py-px font-mono text-[10px] font-medium">Space</kbd>
            </button>
            <button className="btn !px-2.5" onClick={resetTimer} disabled={!live || !canEdit} title="Reset cue timer"><Timer size={15} /><span className="hidden xl:inline">Reset</span></button>
          </div>
        </div>
      </div>
    </header>
  );
}

function SyncPill({ state, by, canEdit, error }: { state: string; by: string | null; canEdit: boolean; error?: string }) {
  if (!canEdit)
    return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-raise px-2 py-0.5 text-[11px] font-medium text-fg-muted"><Eye size={11} /> View only</span>;
  const map: Record<string, [React.ReactNode, string, string]> = {
    loading: [<Loader2 key="l" size={11} className="animate-spin" />, "Loading", "text-fg-muted"],
    saving: [<Loader2 key="s" size={11} className="animate-spin" />, "Saving…", "text-fg-muted"],
    synced: [<CheckIcon key="c" size={11} />, by ? `Saved · ${by}` : "Saved", "text-pvw"],
    offline: [<CloudOff key="o" size={11} />, "Offline — retrying", "text-cg"],
    error: [<CloudOff key="e" size={11} />, error ? `Sync error: ${error}` : "Sync error — retrying", "text-pgm"],
  };
  const [icon, text, color] = map[state] ?? map.synced;
  return <span title={error || (by ? `Last change by ${by}` : "")} className={cx("inline-flex max-w-[360px] shrink-0 items-center gap-1 truncate rounded-full bg-raise px-2 py-0.5 text-[11px] font-medium", color)}>{icon}<span className="truncate">{text}</span></span>;
}

function Tele({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="min-w-[96px] border-l border-line pl-6">
      <div className="label">{label}</div>
      <div className={cx("font-mono text-[22px] font-semibold leading-tight tabular-nums tracking-tight text-fg", valueClass)}>{value}</div>
      {sub !== undefined && <div className="text-[11px] text-fg-muted">{sub}</div>}
    </div>
  );
}

function MenuItem({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-raise", danger ? "text-pgm" : "text-fg")}>
      <span className={danger ? "" : "text-fg-muted"}>{icon}</span>{children}
    </button>
  );
}
