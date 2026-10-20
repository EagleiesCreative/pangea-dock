"use client";
import React from "react";
import { useShow } from "@/lib/store";
import { computeTimes, fmtHMS } from "@/lib/time";

const T = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
  <table className="mb-5 w-full border-collapse text-[10.5px]">
    <thead><tr>{head.map((h) => <th key={h} className="border border-gray-400 bg-gray-200 px-1.5 py-1 text-left font-bold">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-gray-300 px-1.5 py-1 align-top">{c}</td>)}</tr>)}</tbody>
  </table>
);
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-1 mt-4 border-b-2 border-black pb-0.5 text-sm font-bold uppercase tracking-wide">{children}</h2>;

export function PrintBook({ onClose }: { onClose: () => void }) {
  const { show: s } = useShow();
  const times = computeTimes(s.cues, s.event.startTime);
  const yn = (b: boolean) => (b ? "✓" : "—");
  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-white p-8 text-black print:static print:p-0">
      <div className="no-print sticky top-0 mb-4 flex items-center gap-2 rounded bg-gray-100 p-2 shadow">
        <button className="rounded bg-black px-3 py-1.5 text-xs font-semibold text-white" onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="rounded border border-gray-400 px-3 py-1.5 text-xs" onClick={onClose}>Close</button>
        <span className="text-xs text-gray-500">Tip: enable "Background graphics" off and landscape for best fit.</span>
      </div>
      <h1 className="text-xl font-extrabold">{s.event.name}</h1>
      <p className="text-xs text-gray-600">{s.event.venue} · {s.event.format} · Show start {s.event.startTime} · Production Book generated {new Date().toLocaleString()}</p>

      <H>Run of Show</H>
      <T head={["Cue", "Start", "Dur", "Segment", "Video", "Audio", "CG", "Notes"]} rows={times.map(({ cue, start }) => [cue.num, fmtHMS(start), cue.dur, cue.title, cue.source, cue.audio, cue.cg, cue.notes])} />
      <H>Camera Plot</H>
      <T head={["Cam", "Operator", "Body", "Lens", "Mount", "Framing", "Cable", "Comms", "Tally"]} rows={s.cameras.map((c) => [c.label, c.operator, c.body, c.lens, c.mount, c.framing, c.cable, c.comms, c.tally])} />
      <H>Switcher Inputs</H>
      <T head={["#", "Label", "Signal", "Res", "IP / NDI", "Audio", "Status"]} rows={[...s.inputs].sort((a, b) => a.num - b.num).map((i) => [i.num, i.label, i.type, i.res, i.ip, yn(i.audio), i.status])} />
      <H>Outputs / Aux</H>
      <T head={["Port", "Destination", "Res", "CG"]} rows={s.outputs.map((o) => [o.port, o.dest, o.res, yn(o.cg)])} />
      <H>Media &amp; Sponsors</H>
      <T head={["Asset", "File", "Category", "Dur", "Audio", "Slot", "QC"]} rows={s.media.map((m) => [m.assetId, m.file, m.category, m.dur, m.audio, m.slot, m.qc])} />
      <H>Speakers / Lower Thirds</H>
      <T head={["#", "Name", "Title", "Phonetic", "Cue", "Template"]} rows={[...s.speakers].sort((a, b) => a.order - b.order).map((p) => [p.order, p.name, p.title, p.phonetic, p.cue, p.template])} />
      <H>Gear Inventory</H>
      <T head={["Category", "Item", "Qty", "Tag", "Packed", "Loaded", "Out", "Notes"]} rows={s.gear.map((g) => [g.cat, g.name, g.qty, g.tag, yn(g.packed), yn(g.loaded), yn(g.out), g.notes])} />
      <H>Pre-Flight QC</H>
      <T head={["Department", "Check", "Done"]} rows={s.qc.map((q) => [q.dept, q.text, yn(q.done)])} />
      <p className="text-[10px] text-gray-500">Stream credentials intentionally omitted from printed output.</p>
    </div>
  );
}
