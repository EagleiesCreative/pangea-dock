"use client";
import React from "react";
import { Download, Trash2 } from "lucide-react";
import { useShow } from "@/lib/store";
import { fmtDelta, perfCsv, perfRows } from "@/lib/perf";
import { fmtHMS, fmtSigned } from "@/lib/time";
import { download, slug } from "@/lib/export";
import { Modal } from "../Modal";
import { cx } from "../ui";

/** Proof of performance: what actually went to air, when, for how long, and who called it. */
export function PerfLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show, clearPerfLog, canEdit } = useShow();
  const rows = perfRows(show.perfLog ?? []);
  const lastStart = rows.length ? rows[rows.length - 1].startDelta : 0;
  const closed = rows.filter((r) => r.durDelta != null);
  const totalOver = closed.reduce((a, r) => a + (r.durDelta as number), 0);
  const tone = (n: number | null) => (n == null || Math.abs(n) < 0.5 ? "text-fg-muted" : n > 0 ? "text-pgm" : "text-pvw");

  return (
    <Modal open={open} onClose={onClose} wide title="Proof of performance" sub="Every take is logged automatically while Live Show Mode is on.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Stat label="Items aired" value={String(rows.length)} />
        <Stat label="Last start vs plan" value={rows.length ? fmtDelta(lastStart) : "—"} cls={tone(rows.length ? lastStart : null)} />
        <Stat label="Run-time vs plan" value={closed.length ? fmtDelta(totalOver) : "—"} cls={tone(closed.length ? totalOver : null)} />
        <div className="ml-auto flex gap-2">
          <button className="btn" disabled={!rows.length} onClick={() => download(`${slug(show.event.name)}-proof-of-performance.csv`, perfCsv(show.perfLog), "text/csv")}><Download size={14} /> CSV</button>
          <button className="btn !text-pgm" disabled={!rows.length || !canEdit} onClick={() => window.confirm("Clear the whole log? Export it first if you need it.") && clearPerfLog()}><Trash2 size={14} /> Clear</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
          <thead><tr className="bg-raise/60 text-left">
            {["Cue", "Title", "Planned", "Actual", "Δ start", "Dur", "Δ dur", "Called by"].map((h) => <th key={h} className="th">{h}</th>)}
          </tr></thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.e.id} className="border-t border-line">
                <td className="td font-mono font-semibold">{r.e.num}</td>
                <td className="td max-w-[200px] truncate">{r.e.title}</td>
                <td className="td font-mono text-fg-muted">{fmtHMS(r.e.plannedStart)}</td>
                <td className="td font-mono">{fmtHMS(r.actualStartTod)}</td>
                <td className={cx("td font-mono", tone(r.startDelta))}>{fmtDelta(r.startDelta)}</td>
                <td className="td font-mono">{r.actualDur == null ? <span className="text-pgm">on air</span> : fmtSigned(Math.round(r.actualDur))}</td>
                <td className={cx("td font-mono", tone(r.durDelta))}>{r.durDelta == null ? "" : fmtDelta(r.durDelta)}</td>
                <td className="td text-fg-muted">{r.e.by ?? ""}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-fg-muted">Nothing logged yet. Turn on Live Show Mode and take cues.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return <div className="rounded-xl border border-line px-3 py-1.5"><div className="label">{label}</div><div className={cx("font-mono text-sm font-semibold text-fg", cls)}>{value}</div></div>;
}
