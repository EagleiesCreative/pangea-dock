"use client";
import React from "react";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2, ListPlus } from "lucide-react";
import { uid, useShow } from "@/lib/store";
import { computeTimes, fmtHMS, fmtMS, parseHMS } from "@/lib/time";
import { Area, Badge, Cell, DurationCell, IconBtn, SectionHead, Sel, TableWrap, cx } from "./ui";
import type { Cue } from "@/lib/types";

const blank = (): Cue => ({ id: uid(), num: "", dur: "01:00", title: "New segment", source: "", audio: "", cg: "", notes: "" });

export function Ros() {
  const { show, patch, patchEvent, add, remove, move, dup } = useShow();
  const times = computeTimes(show.cues, show.event.startTime);
  const total = times.length ? times[times.length - 1].end - (parseHMS(show.event.startTime) ?? 0) : 0;
  const idx = show.live.idx;
  const sources = ["", ...show.inputs.map((i) => i.label)];
  const [startDraft, setStartDraft] = React.useState(show.event.startTime);
  React.useEffect(() => setStartDraft(show.event.startTime), [show.event.startTime]);
  const startBad = parseHMS(startDraft) == null;
  const speakerCgs = show.speakers.map((s) => `LT: ${s.name}`);
  const mediaCgs = show.media.map((m) => `MEDIA: ${m.assetId} ${m.file}`);

  return (
    <section>
      <SectionHead title="Live Run-of-Show & Technical Cue Sheet" accent="bg-pgm" sub={`${show.cues.length} cues · total ${fmtMS(total)} · ends ${times.length ? fmtHMS(times[times.length - 1].end) : "--"}`}>
        <label className="flex items-center gap-2 text-xs text-fg-soft">
          <span className="label">Show start</span>
          <input
            className={cx("w-28 rounded-full border bg-surface px-3 py-1.5 text-center font-mono text-[13px] outline-none focus:ring-2 focus:ring-brand/20", startBad ? "border-pgm text-pgm" : "border-line text-fg")}
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
            onBlur={() => { const s = parseHMS(startDraft); if (s == null) setStartDraft(show.event.startTime); else patchEvent({ startTime: fmtHMS(s) }); }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            title="HH:MM:SS"
          />
        </label>
        <button className="btn" onClick={() => add("cues", blank())}><Plus size={14} /> Add cue</button>
      </SectionHead>

      <datalist id="cg-options">{[...speakerCgs, ...mediaCgs].map((o) => <option key={o} value={o} />)}</datalist>
      <TableWrap>
        <thead>
          <tr>
            <th className="th w-[88px]">Tally</th>
            <th className="th w-[70px]">Cue #</th>
            <th className="th w-[96px]">Start</th>
            <th className="th w-[84px]">Duration</th>
            <th className="th min-w-[220px]">Segment / Action Title</th>
            <th className="th min-w-[170px]">Video / Switcher Source</th>
            <th className="th min-w-[210px]">Audio Cue</th>
            <th className="th min-w-[190px]">CG / Lower Third</th>
            <th className="th min-w-[240px]">TD &amp; Stage Notes</th>
            <th className="th w-[150px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {times.map(({ cue, start }, i) => {
            const isPgm = show.live.on && i === idx;
            const isPvw = show.live.on && i === idx + 1;
            const past = show.live.on && i < idx;
            return (
              <tr key={cue.id} className={cx("border-t border-line", isPgm && "bg-pgm/10", isPvw && "bg-pvw/[0.07]", past && "opacity-45")}>
                <td className={cx("td border-l-[3px] !align-middle", isPgm ? "border-l-pgm" : isPvw ? "border-l-pvw" : "border-l-transparent")}>
                  {isPgm && <Badge tone="red"><span className="h-1.5 w-1.5 animate-tally rounded-full bg-pgm" />PGM · On air</Badge>}
                  {isPvw && <Badge tone="green">PVW · Standby</Badge>}
                </td>
                <td className="td"><Cell mono value={cue.num} onChange={(v) => patch("cues", cue.id, { num: v })} placeholder="A01" className="font-bold" /></td>
                <td className="td !align-middle px-2 font-mono text-[13px] tabular-nums text-vid">{fmtHMS(start)}</td>
                <td className="td"><DurationCell value={cue.dur} onChange={(v) => patch("cues", cue.id, { dur: v })} /></td>
                <td className="td"><Cell value={cue.title} onChange={(v) => patch("cues", cue.id, { title: v })} className="font-medium" /></td>
                <td className="td"><Sel value={cue.source} options={sources} onChange={(v) => patch("cues", cue.id, { source: v })} className="!text-vid" /></td>
                <td className="td"><Cell value={cue.audio} onChange={(v) => patch("cues", cue.id, { audio: v })} className="!text-aud" placeholder="Audio cue" /></td>
                <td className="td">
                  <Cell value={cue.cg} list="cg-options" onChange={(v) => patch("cues", cue.id, { cg: v })} className="!text-cg" placeholder="CG / LT" />
                </td>
                <td className="td"><Area value={cue.notes} onChange={(v) => patch("cues", cue.id, { notes: v })} className="text-fg-soft" /></td>
                <td className="td whitespace-nowrap">
                  <IconBtn title="Insert cue below" onClick={() => add("cues", blank(), cue.id)}><ListPlus size={15} /></IconBtn>
                  <IconBtn title="Move up" disabled={i === 0} onClick={() => move("cues", cue.id, -1)}><ArrowUp size={15} /></IconBtn>
                  <IconBtn title="Move down" disabled={i === times.length - 1} onClick={() => move("cues", cue.id, 1)}><ArrowDown size={15} /></IconBtn>
                  <IconBtn title="Duplicate" onClick={() => dup("cues", cue.id)}><CopyPlus size={15} /></IconBtn>
                  <IconBtn title="Delete cue" danger onClick={() => remove("cues", cue.id)}><Trash2 size={15} /></IconBtn>
                </td>
              </tr>
            );
          })}
          {times.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-sm text-fg-muted">No cues. Add the first one.</td></tr>}
        </tbody>
      </TableWrap>
      <p className="mt-2 text-[11px] text-fg-muted">Start times recalculate from the Master Show Start and each row's duration. Reorder, insert or edit a duration and every following row updates. Press <kbd className="rounded bg-raise px-1 font-mono">Space</kbd> in Live Show Mode to take the next cue.</p>
    </section>
  );
}
