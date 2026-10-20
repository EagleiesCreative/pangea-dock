"use client";
import React, { useState } from "react";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { uid, useShow } from "@/lib/store";
import { download, slug, speakerRows, speakersCsv } from "@/lib/export";
import { Badge, Cell, IconBtn, SectionHead, Sel, TableWrap, cx } from "./ui";
import type { AudioMode, MediaAsset, MediaCategory, MediaQc, Speaker } from "@/lib/types";

const CATS: MediaCategory[] = ["Sponsor Loop", "Video Bumper (VT)", "Stinger Transition", "Walk-In Audio", "Emergency Slate"];
const AUDIO: AudioMode[] = ["AFV", "Mute", "Loop"];
const QC_FLOW: MediaQc[] = ["Missing", "Loaded", "QC Verified"];

export function Media() {
  const { show, add, patch, remove } = useShow();
  const [filter, setFilter] = useState<MediaCategory | "All">("All");
  const rows = show.media.filter((m) => filter === "All" || m.category === filter);
  const cues = show.cues.map((c) => c.num).filter(Boolean);
  const nextQc = (q: MediaQc) => QC_FLOW[(QC_FLOW.indexOf(q) + 1) % QC_FLOW.length];
  const qcTone = (q: MediaQc) => (q === "QC Verified" ? "green" : q === "Loaded" ? "amber" : "red");
  const nextAssetId = () => `MED-${String(show.media.length + 1).padStart(3, "0")}`;

  const reorderSpeaker = (id: string, order: number) => patch("speakers", id, { order });
  const speakers = [...show.speakers].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-8">
      <section>
        <SectionHead title="Media & Sponsor Playback Queue" accent="bg-med" sub={`${rows.length} of ${show.media.length} assets`}>
          <select className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-fg outline-none focus:border-med/60" value={filter} onChange={(e) => setFilter(e.target.value as MediaCategory | "All")} aria-label="Filter by category">
            <option value="All">All categories</option>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn" onClick={() => add("media", { id: uid(), assetId: nextAssetId(), file: "", category: filter === "All" ? "Video Bumper (VT)" : filter, dur: "00:30", audio: "AFV", slot: "", qc: "Missing" } as MediaAsset)}><Plus size={14} /> Add asset</button>
        </SectionHead>
        <TableWrap>
          <thead><tr>
            <th className="th w-[100px]">Asset ID</th><th className="th min-w-[240px]">File Name</th><th className="th w-[170px]">Category</th>
            <th className="th w-[84px]">Duration</th><th className="th w-[100px]">Audio Mode</th><th className="th min-w-[180px]">Target Switcher Slot</th>
            <th className="th w-[130px]">QC Status</th><th className="th w-[44px]" />
          </tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="td"><Cell mono value={m.assetId} onChange={(v) => patch("media", m.id, { assetId: v })} className="!text-med font-bold" /></td>
                <td className="td"><Cell mono value={m.file} onChange={(v) => patch("media", m.id, { file: v })} placeholder="file_name.mov" /></td>
                <td className="td"><Sel value={m.category} options={CATS} onChange={(v) => patch("media", m.id, { category: v })} /></td>
                <td className="td"><Cell mono value={m.dur} onChange={(v) => patch("media", m.id, { dur: v })} /></td>
                <td className="td"><Sel value={m.audio} options={AUDIO} onChange={(v) => patch("media", m.id, { audio: v })} /></td>
                <td className="td"><Cell value={m.slot} onChange={(v) => patch("media", m.id, { slot: v })} placeholder="vMix VT-1 / Slot 1" /></td>
                <td className="td !align-middle">
                  <button onClick={() => patch("media", m.id, { qc: nextQc(m.qc) })} title="Click to advance: Missing → Loaded → QC Verified" className="rounded focus:outline-none focus-visible:ring-2 ring-med">
                    <Badge tone={qcTone(m.qc)}>{m.qc === "QC Verified" ? "✓ " : ""}{m.qc}</Badge>
                  </button>
                </td>
                <td className="td !align-middle"><IconBtn title="Delete asset" danger onClick={() => remove("media", m.id)}><Trash2 size={15} /></IconBtn></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-sm text-fg-muted">No assets in this category.</td></tr>}
          </tbody>
        </TableWrap>
        <div className="mt-1.5 flex gap-2">
          {QC_FLOW.map((q) => <Badge key={q} tone={qcTone(q)}>{show.media.filter((m) => m.qc === q).length} {q}</Badge>)}
        </div>
      </section>

      <section>
        <SectionHead title="Speaker & Lower-Third (CG) Database" accent="bg-cg" sub={`${speakers.length} speakers`}>
          <button className="btn" onClick={() => download(`${slug(show.event.name)}-lower-thirds.json`, JSON.stringify(speakerRows(show), null, 2), "application/json")}><FileDown size={14} /> Export JSON for vMix</button>
          <button className="btn" onClick={() => download(`${slug(show.event.name)}-lower-thirds.csv`, speakersCsv(show), "text/csv")}><FileDown size={14} /> Export CSV for vMix</button>
          <button className="btn" onClick={() => add("speakers", { id: uid(), order: Math.max(0, ...show.speakers.map((s) => s.order)) + 1, name: "", title: "", phonetic: "", cue: "", template: "LT-2Line" } as Speaker)}><Plus size={14} /> Add speaker</button>
        </SectionHead>
        <TableWrap>
          <thead><tr>
            <th className="th w-[64px]">Order</th><th className="th min-w-[180px]">Full Display Name</th><th className="th min-w-[260px]">Title / Organization</th>
            <th className="th min-w-[190px]">Phonetic Pronunciation</th><th className="th w-[110px]">Assigned Cue</th><th className="th min-w-[160px]">CG Template Layer</th><th className="th w-[44px]" />
          </tr></thead>
          <tbody>
            {speakers.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="td"><Cell mono type="number" value={s.order} onChange={(v) => reorderSpeaker(s.id, +v || 0)} className="!text-cg font-bold" /></td>
                <td className="td"><Cell value={s.name} onChange={(v) => patch("speakers", s.id, { name: v })} className="font-medium" placeholder="Full name" /></td>
                <td className="td"><Cell value={s.title} onChange={(v) => patch("speakers", s.id, { title: v })} placeholder="Title / Organization" /></td>
                <td className="td"><Cell value={s.phonetic} onChange={(v) => patch("speakers", s.id, { phonetic: v })} className="italic text-fg-soft" placeholder="PRO-nun-see-AY-shun" /></td>
                <td className="td"><Sel value={s.cue} options={["", ...cues]} onChange={(v) => patch("speakers", s.id, { cue: v })} mono /></td>
                <td className="td"><Cell mono value={s.template} onChange={(v) => patch("speakers", s.id, { template: v })} className={cx("!text-cg")} /></td>
                <td className="td !align-middle"><IconBtn title="Delete speaker" danger onClick={() => remove("speakers", s.id)}><Trash2 size={15} /></IconBtn></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <p className="mt-2 text-[11px] text-fg-muted">In vMix: Add Input → Data Source → Excel/CSV or JSON, then bind <code className="font-mono text-fg-soft">Name</code> and <code className="font-mono text-fg-soft">Title</code> to your title's text layers. Re-export after edits and vMix refreshes from the file.</p>
      </section>
    </div>
  );
}
