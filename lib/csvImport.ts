// Import a run-of-show from CSV / TSV / text pasted from Google Sheets or Excel.
import { fmtHMS, fmtMS, parseHMS } from "./time";
import type { Cue } from "./types";

export type Field = "skip" | "type" | "num" | "start" | "dur" | "end" | "title" | "source" | "audio" | "cg" | "notes";
export const FIELDS: { id: Field; label: string }[] = [
  { id: "skip", label: "— Skip —" },
  { id: "type", label: "Row type (cue / section)" },
  { id: "num", label: "Cue #" },
  { id: "title", label: "Title" },
  { id: "dur", label: "Duration" },
  { id: "start", label: "Start time" },
  { id: "end", label: "End time" },
  { id: "source", label: "Video source" },
  { id: "audio", label: "Audio cue" },
  { id: "cg", label: "CG / lower third" },
  { id: "notes", label: "Notes" },
];

const SYN: [Field, RegExp][] = [
  ["type", /^(type|row ?type|kind|item ?type|category)$/],
  ["num", /^(cue|cue ?#|cue ?no\.?|cue ?number|#|no\.?|number|id|item ?#|seq)$/],
  ["start", /^(start|start ?time|time|begin|in|time ?in|scheduled|planned ?start)$/],
  ["end", /^(end|end ?time|out|time ?out|finish)$/],
  ["dur", /^(dur|duration|length|len|run ?time|time ?allotted|mins?|minutes|planned ?dur(ation)?)$/],
  ["title", /^(title|segment|item|name|description|segment ?title|action|what|content|subject)$/],
  ["source", /^(video|source|switcher|camera|cam|vision|video ?source|vid)$/],
  ["audio", /^(audio|sound|mic|mics|audio ?cue|music)$/],
  ["cg", /^(cg|gfx|graphics?|lower ?thirds?|lt|l3|super|titles?)$/],
  ["notes", /^(notes?|td ?notes?|comments?|remarks?|script|details?|stage ?notes?|presenter|talent|speaker|who)$/],
];

/** Split delimited text. Handles quotes, escaped quotes and newlines inside quotes. Delimiter auto-detected. */
export function parseDelimited(text: string): { rows: string[][]; delim: string } {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const first = src.split("\n").find((l) => l.trim()) ?? "";
  const counts = ["\t", ",", ";", "|"].map((d) => [d, first.split(d).length - 1] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return { rows: rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean)), delim };
}

const norm = (h: string) => h.toLowerCase().replace(/[_\-]+/g, " ").replace(/[()]/g, "").replace(/\s+/g, " ").trim();
export function guessMapping(header: string[]): Field[] {
  const used = new Set<Field>();
  return header.map((h) => {
    const n = norm(h);
    const hit = SYN.find(([f, re]) => !used.has(f) && re.test(n));
    if (hit) { used.add(hit[0]); return hit[0]; }
    return "skip";
  });
}
/** True if the first row looks like column names rather than data. */
export function looksLikeHeader(r: string[]) {
  return r.some((c) => SYN.some(([, re]) => re.test(norm(c)))) && !r.some((c) => /^\d{1,2}:\d{2}/.test(c));
}

/** "5" (minutes or seconds), "5:00", "1:05:00", "5m", "1h 30m", "90s", "1.5", "5 min" → seconds. */
export function parseDuration(raw: string, plainUnit: "min" | "sec" = "min"): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(+t * (plainUnit === "min" ? 60 : 1));
  let m = /^(\d{1,3}):(\d{2})$/.exec(t);
  if (m && +m[2] < 60) return +m[1] * 60 + +m[2];
  m = /^(\d{1,2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(t);
  if (m && +m[2] < 60 && +m[3] < 60) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  const units = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs|hr|h|minutes?|mins|min|m|'|seconds?|secs|sec|s|")/g)];
  if (units.length && units.map((u) => u[0]).join("").replace(/\s/g, "") === t.replace(/\s/g, "")) {
    return Math.round(units.reduce((a, [, n, u]) => a + +n * (u.startsWith("h") ? 3600 : u.startsWith("m") || u === "'" ? 60 : 1), 0));
  }
  return null;
}
/** "19:00", "19:00:00", "7:00 PM", "7pm" → seconds of day. */
export function parseClock(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  const m = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m || (!m[2] && !m[4])) return parseHMS(t);
  let h = +m[1];
  const mi = m[2] ? +m[2] : 0, s = m[3] ? +m[3] : 0;
  if (m[4]) { if (h === 12) h = 0; if (m[4].startsWith("p")) h += 12; }
  if (h > 23 || mi > 59 || s > 59) return null;
  return h * 3600 + mi * 60 + s;
}

export interface ImportOpts { mapping: Field[]; hasHeader: boolean; plainUnit: "min" | "sec"; noNumIsSection: boolean; defaultDur: number }
export interface ImportResult { cues: Cue[]; startTime: string | null; warnings: string[] }

const rid = () => Math.random().toString(36).slice(2, 9);
const SECTION_RE = /^(section|header|segment ?header|block|chapter|part|group|act)$/i;

export function buildCues(rows: string[][], o: ImportOpts): ImportResult {
  const data = o.hasHeader ? rows.slice(1) : rows;
  const col = (f: Field) => o.mapping.indexOf(f);
  const get = (r: string[], f: Field) => { const i = col(f); return i >= 0 ? (r[i] ?? "").trim() : ""; };
  const warnings: string[] = [];
  const starts = data.map((r) => (col("start") >= 0 ? parseClock(get(r, "start")) : null));
  const ends = data.map((r) => (col("end") >= 0 ? parseClock(get(r, "end")) : null));
  let badDur = 0;

  const cues: Cue[] = data.map((r, i) => {
    const typ = get(r, "type");
    const num = get(r, "num");
    const title = get(r, "title");
    const section = SECTION_RE.test(typ) || (o.noNumIsSection && !num && !!title);
    let dur: number | null = col("dur") >= 0 ? parseDuration(get(r, "dur"), o.plainUnit) : null;
    if (dur == null && col("dur") >= 0 && get(r, "dur")) badDur++;
    if (dur == null && starts[i] != null && ends[i] != null) dur = ((ends[i]! - starts[i]! + 86400) % 86400);
    if (dur == null && starts[i] != null) {
      const n = starts.findIndex((s, j) => j > i && s != null);
      if (n > 0) dur = ((starts[n]! - starts[i]! + 86400) % 86400);
    }
    return {
      id: rid(), kind: section ? "section" : "cue", num: section ? "" : num, dur: fmtMS(dur ?? o.defaultDur),
      title: title || (section ? "Section" : "Untitled"), source: get(r, "source"), audio: get(r, "audio"), cg: get(r, "cg"), notes: get(r, "notes"),
    };
  });
  if (badDur) warnings.push(`${badDur} duration${badDur === 1 ? "" : "s"} couldn't be read and got the default.`);
  if (col("title") < 0) warnings.push("No column is mapped to Title.");
  const firstStart = starts.find((s) => s != null);
  return { cues, startTime: firstStart != null ? fmtHMS(firstStart) : null, warnings };
}
