"use client";
import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, FileUp, Upload } from "lucide-react";
import { useShow } from "@/lib/store";
import { FIELDS, buildCues, guessMapping, looksLikeHeader, parseDelimited, type Field } from "@/lib/csvImport";
import { computeTimes, fmtHMS } from "@/lib/time";
import { Modal } from "./Modal";
import { Badge, cx } from "./ui";

/** Run-of-show import from a CSV/TSV file or rows pasted from Google Sheets / Excel / Shoflo exports. */
export function ImportCsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show, setShow } = useShow();
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Field[] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [plainUnit, setPlainUnit] = useState<"min" | "sec">("min");
  const [noNumIsSection, setNoNumIsSection] = useState(false);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [useStart, setUseStart] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() ? parseDelimited(text) : null), [text]);
  const load = (t: string) => {
    setText(t);
    const p = parseDelimited(t);
    const head = p.rows[0] ?? [];
    const isHead = looksLikeHeader(head);
    setHasHeader(isHead);
    setMapping(isHead ? guessMapping(head) : head.map((_, i) => (["num", "title", "dur", "notes"][i] as Field) ?? "skip"));
  };
  const width = parsed ? Math.max(...parsed.rows.map((r) => r.length)) : 0;
  const map = mapping ? [...mapping, ...Array(Math.max(0, width - mapping.length)).fill("skip")] as Field[] : [];
  const result = useMemo(() => (parsed && mapping ? buildCues(parsed.rows, { mapping: map, hasHeader, plainUnit, noNumIsSection, defaultDur: 300 }) : null),
    [parsed, mapping, hasHeader, plainUnit, noNumIsSection]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = result ? computeTimes(mode === "append" ? [...show.cues, ...result.cues] : result.cues, useStart && result.startTime && mode === "replace" ? result.startTime : show.event.startTime) : [];
  const firstNew = mode === "append" ? show.cues.length : 0;

  const reset = () => { setText(""); setMapping(null); };
  const apply = () => {
    if (!result?.cues.length) return;
    if (mode === "replace" && !window.confirm(`Replace all ${show.cues.length} rows of the current run-of-show with ${result.cues.length} imported rows? (You can undo this from Version history.)`)) return;
    setShow((s) => ({
      ...s,
      cues: mode === "append" ? [...s.cues, ...result.cues] : result.cues,
      event: mode === "replace" && useStart && result.startTime ? { ...s.event, startTime: result.startTime } : s.event,
      live: mode === "replace" ? { ...s.live, on: false, idx: 0, startedAt: null } : s.live,
    }));
    reset(); onClose();
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} wide title="Import run-of-show" sub="CSV or TSV file, or paste rows straight from Google Sheets, Excel or a Shoflo/Lasso export.">
      {!parsed ? (
        <div className="space-y-3">
          <textarea autoFocus rows={8} placeholder={"Paste here (⌘/Ctrl+V)…\n\nCue #\tDuration\tTitle\tNotes\nA01\t2:30\tOpening VT\tRoll on GO"}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); load(t); } }}
            onChange={(e) => e.target.value.includes("\n") && load(e.target.value)}
            className="w-full resize-none rounded-2xl border-2 border-dashed border-line bg-raise/30 p-4 font-mono text-[12px] text-fg outline-none placeholder:text-fg-faint focus:border-brand/40" />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => fileRef.current?.click()}><FileUp size={14} /> Choose CSV / TSV file…</button>
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><ClipboardPaste size={13} /> In Google Sheets: select the rows (with the header row) → Copy → paste above.</span>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text()); e.target.value = ""; }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label">Match columns · {parsed.rows.length - (hasHeader ? 1 : 0)} rows · {parsed.delim === "\t" ? "tab" : parsed.delim === "," ? "comma" : parsed.delim === ";" ? "semicolon" : "pipe"}-separated</span>
              <button className="text-xs font-medium text-brand hover:underline" onClick={reset}>Start over</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-[12px]">
                <thead><tr>{map.map((f, i) => (
                  <th key={i} className="border-b border-line bg-raise/50 p-1.5 text-left">
                    <select value={f} onChange={(e) => setMapping(map.map((x, j) => (j === i ? (e.target.value as Field) : x === e.target.value && e.target.value !== "skip" ? "skip" : x)))}
                      className={cx("w-full min-w-[120px] rounded-lg border bg-surface px-1.5 py-1 text-[12px] outline-none", f === "skip" ? "border-line text-fg-muted" : "border-brand/40 font-medium text-brand")}>
                      {FIELDS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </th>
                ))}</tr></thead>
                <tbody>{parsed.rows.slice(0, 4).map((r, ri) => (
                  <tr key={ri} className={cx(ri === 0 && hasHeader && "bg-raise/40 font-medium text-fg-muted")}>
                    {map.map((_, ci) => <td key={ci} className="max-w-[180px] truncate border-t border-line px-2 py-1">{r[ci] ?? ""}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-2 text-[13px] text-fg-soft sm:grid-cols-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> First row is column names</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={noNumIsSection} onChange={(e) => setNoNumIsSection(e.target.checked)} /> Rows without a cue # are sections</label>
            <label className="flex items-center gap-2">Plain numbers in Duration are
              <select value={plainUnit} onChange={(e) => setPlainUnit(e.target.value as "min" | "sec")} className="rounded-lg border border-line bg-surface px-1.5 py-0.5 text-[12px]"><option value="min">minutes</option><option value="sec">seconds</option></select>
            </label>
            <div className="flex items-center gap-2">
              <span>Import as</span>
              <div className="inline-flex rounded-full border border-line p-0.5">
                {(["append", "replace"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cx("rounded-full px-2.5 py-0.5 text-xs font-medium", mode === m ? "bg-inverse text-on-inverse" : "text-fg-muted")}>{m === "append" ? "Add to end" : "Replace all"}</button>)}
              </div>
            </div>
            {mode === "replace" && result?.startTime && (
              <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={useStart} onChange={(e) => setUseStart(e.target.checked)} /> Set show start to <span className="font-mono">{result.startTime}</span> (first start time in the file)</label>
            )}
          </div>

          {!!result?.warnings.length && (
            <div className="space-y-1 rounded-xl bg-cg/10 px-3 py-2 text-xs text-fg">{result.warnings.map((w) => <div key={w} className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-cg" />{w}</div>)}</div>
          )}

          <div>
            <div className="label mb-1.5">Preview</div>
            <div className="max-h-[220px] overflow-y-auto rounded-xl border border-line">
              {preview.slice(firstNew).map((r) => (
                <div key={r.cue.id} className={cx("flex items-center gap-3 border-t border-line px-3 py-1.5 text-[12.5px] first:border-t-0", r.isSection && "bg-brand-soft/60 font-semibold uppercase tracking-wide")}>
                  <span className="w-[62px] shrink-0 font-mono text-fg-muted">{fmtHMS(r.start)}</span>
                  <span className="w-[44px] shrink-0 font-mono text-fg-soft">{r.isSection ? <Badge tone="violet">§</Badge> : r.cue.num}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{r.cue.title}</span>
                  <span className="font-mono text-fg-muted">{r.cue.dur}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button className="btn" onClick={() => { reset(); onClose(); }}>Cancel</button>
            <button className="btn-primary" disabled={!result?.cues.length} onClick={apply}><Upload size={14} /> Import {result?.cues.length ?? 0} rows</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
