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

export interface Timed<T> { cue: T; start: number; end: number; durSec: number }
/** Cumulative start/end for each cue from a master start. */
export function computeTimes<T extends { dur: string }>(cues: T[], startTime: string): Timed<T>[] {
  let t = parseHMS(startTime) ?? 0;
  return cues.map((cue) => {
    const durSec = parseMS(cue.dur) ?? 0;
    const row = { cue, start: t, end: t + durSec, durSec };
    t += durSec;
    return row;
  });
}
