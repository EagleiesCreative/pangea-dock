const DAY = 86400;
const p2 = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");

/** "19:00:00" or "19:00" -> seconds. Returns null if invalid. */
export function parseHMS(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2], se = m[3] ? +m[3] : 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  return h * 3600 + mi * 60 + se;
}
/** "03:30" -> 210. Also accepts "90" (seconds) and "1:02:03". Null if invalid. */
export function parseMS(s: string): number | null {
  const t = s.trim();
  if (/^\d+$/.test(t)) return +t;
  let m = /^(\d{1,3}):(\d{2})$/.exec(t);
  if (m && +m[2] < 60) return +m[1] * 60 + +m[2];
  m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(t);
  if (m && +m[2] < 60 && +m[3] < 60) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  return null;
}
export function fmtHMS(sec: number): string {
  const s = ((Math.round(sec) % DAY) + DAY) % DAY;
  return `${p2(s / 3600)}:${p2((s % 3600) / 60)}:${p2(s % 60)}`;
}
export function fmtMS(sec: number): string {
  const s = Math.round(Math.abs(sec));
  return `${p2(s / 60)}:${p2(s % 60)}`;
}
/** Unsigned length: MM:SS under an hour, H:MM:SS above. */
export function fmtLen(sec: number): string {
  const s = Math.round(Math.abs(sec));
  return s < 3600 ? fmtMS(s) : `${Math.floor(s / 3600)}:${p2((s % 3600) / 60)}:${p2(s % 60)}`;
}
/** Signed countdown: 15 -> "00:15", -15 -> "-00:15" */
export function fmtSigned(sec: number): string {
  const r = Math.round(sec);
  return (r < 0 ? "-" : "") + fmtMS(r);
}
export function todSeconds(d: Date): number {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
}
/** Wrap a difference to [-12h, +12h) so midnight roll-over doesn't blow up variance. */
export function wrapDiff(d: number): number {
  return ((((d + DAY / 2) % DAY) + DAY) % DAY) - DAY / 2;
}

export interface Timed<T> {
  cue: T;
  start: number;
  end: number;
  /** Seconds this row adds to the running time (0 for a section header that has cues under it). */
  durSec: number;
  isSection: boolean;
  /** Section header with at least one cue before the next section. */
  hasChildren: boolean;
  /** Section only: planned length (its own duration field). */
  plannedSec: number;
  /** Section only: sum of the cues under it (or its own duration when empty). */
  actualSec: number;
  /** Cue only: id of the section it belongs to. */
  sectionId: string | null;
  /** Can be taken live: every cue, plus empty (timed) sections like breaks. */
  playable: boolean;
}

type Row = { id?: string; dur: string; kind?: string };
const isSec = (c: Row) => c.kind === "section";

/** True if the section at i has at least one cue before the next section. */
export function sectionHasChildren(cues: Row[], i: number) {
  return i + 1 < cues.length && !isSec(cues[i + 1]);
}
export function isPlayable(cues: Row[], i: number) {
  return i >= 0 && i < cues.length && !(isSec(cues[i]) && sectionHasChildren(cues, i));
}
export function nextPlayable(cues: Row[], from: number) {
  for (let i = from + 1; i < cues.length; i++) if (isPlayable(cues, i)) return i;
  return -1;
}
export function prevPlayable(cues: Row[], from: number) {
  for (let i = from - 1; i >= 0; i--) if (isPlayable(cues, i)) return i;
  return -1;
}

/**
 * Cumulative start/end from the master start.
 * - Cues add their duration.
 * - A section with cues under it is a header: it adds nothing itself; its planned duration is compared with its cues.
 * - An empty section (break, changeover, doors) is a timed block and adds its duration.
 */
export function computeTimes<T extends Row>(cues: T[], startTime: string): Timed<T>[] {
  let t = parseHMS(startTime) ?? 0;
  let section: Timed<T> | null = null;
  const out: Timed<T>[] = [];
  cues.forEach((cue, i) => {
    const own = parseMS(cue.dur) ?? 0;
    if (isSec(cue)) {
      const kids = sectionHasChildren(cues, i);
      const row: Timed<T> = { cue, start: t, end: t + (kids ? 0 : own), durSec: kids ? 0 : own, isSection: true, hasChildren: kids, plannedSec: own, actualSec: kids ? 0 : own, sectionId: null, playable: !kids };
      out.push(row);
      section = kids ? row : null;
      t += row.durSec;
      return;
    }
    const row: Timed<T> = { cue, start: t, end: t + own, durSec: own, isSection: false, hasChildren: false, plannedSec: 0, actualSec: 0, sectionId: section ? (section.cue.id ?? null) : null, playable: true };
    out.push(row);
    if (section) { section.actualSec += own; section.end = t + own; }
    t += own;
  });
  return out;
}
