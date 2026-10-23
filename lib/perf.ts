import type { PerfEntry, Show } from "./types";
import { computeTimes, fmtHMS, fmtLen, fmtSigned, todSeconds } from "./time";
import { toCsv } from "./export";

const rid = () => Math.random().toString(36).slice(2, 10);
const MAX = 1000;

/** Close any open entry at `now`. */
export const closeLog = (log: PerfEntry[], now: number) => log.map((e) => (e.end == null ? { ...e, end: now } : e));

/** Close the open entry and start one for the row at `idx`. */
export function logTake(s: Show, idx: number, now: number, by: string | null): PerfEntry[] {
  const t = computeTimes(s.cues, s.event.startTime)[idx];
  const log = closeLog(s.perfLog ?? [], now);
  if (!t) return log;
  return [...log, { id: rid(), cueId: t.cue.id, num: t.cue.num || (t.isSection ? "§" : ""), title: t.cue.title, plannedStart: t.start, plannedDur: t.durSec, start: now, end: null, by }].slice(-MAX);
}

/** Restart the open entry's clock (Reset timer). */
export const restartOpen = (log: PerfEntry[], now: number) => log.map((e) => (e.end == null ? { ...e, start: now } : e));

export interface PerfRow { e: PerfEntry; actualStartTod: number; startDelta: number; actualDur: number | null; durDelta: number | null }
export function perfRows(log: PerfEntry[]): PerfRow[] {
  return log.map((e) => {
    const actualStartTod = todSeconds(new Date(e.start));
    let startDelta = actualStartTod - e.plannedStart;
    if (startDelta > 43200) startDelta -= 86400;
    if (startDelta < -43200) startDelta += 86400;
    const actualDur = e.end == null ? null : (e.end - e.start) / 1000;
    return { e, actualStartTod, startDelta, actualDur, durDelta: actualDur == null ? null : actualDur - e.plannedDur };
  });
}

const sgn = (n: number) => (Math.abs(n) < 0.5 ? "0:00" : `${n > 0 ? "+" : "−"}${fmtLen(n)}`);
export function perfCsv(log: PerfEntry[]) {
  return toCsv([
    ["Cue", "Title", "Planned start", "Actual start", "Start Δ", "Planned dur", "Actual dur", "Dur Δ", "Called by", "Date"],
    ...perfRows(log).map((r) => [
      r.e.num, r.e.title, fmtHMS(r.e.plannedStart), fmtHMS(r.actualStartTod), sgn(r.startDelta),
      fmtLen(r.e.plannedDur), r.actualDur == null ? "running" : fmtLen(r.actualDur), r.durDelta == null ? "" : sgn(r.durDelta),
      r.e.by ?? "", new Date(r.e.start).toISOString().slice(0, 10),
    ]),
  ]);
}
export { sgn as fmtDelta };
