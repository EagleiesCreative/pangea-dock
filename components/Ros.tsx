"use client";
import React from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CopyPlus, Crosshair, FileSpreadsheet, FolderPlus, GripVertical, Plus, Trash2, ListPlus, Megaphone, ScrollText, Timer } from "lucide-react";
import { blockRange, moveBlock, reorder, resolveDrop, type DropPos } from "@/lib/reorder";
import { uid, useShow } from "@/lib/store";
import { computeTimes, fmtHMS, fmtMS, fmtSigned, nextPlayable, parseHMS } from "@/lib/time";
import { Area, Badge, Cell, DurationCell, IconBtn, SectionHead, Sel, TableWrap, cx } from "./ui";
import { CommentBtn, CommentThread } from "./Comments";
import { StageMsgModal } from "./live/StageMsgModal";
import { PerfLogModal } from "./live/PerfLogModal";
import { ImportCsvModal } from "./ImportCsvModal";
import type { Cue } from "@/lib/types";

/** Looks like .btn but is an <a>, so it keeps working for viewers inside the read-only <fieldset disabled>. */
function ToolBtn({ children, onClick, href, active, title }: { children: React.ReactNode; onClick?: () => void; href?: string; active?: boolean; title?: string }) {
  return (
    <a href={href ?? "#"} title={title} role={href ? undefined : "button"} aria-pressed={href ? undefined : active}
      target={href ? "_blank" : undefined} rel={href ? "noreferrer" : undefined}
      onClick={(e) => { if (!href) e.preventDefault(); onClick?.(); }}
      className={cx("btn !py-1.5 text-xs", active && "!border-brand/40 !bg-brand-soft !text-brand")}>
      {children}
    </a>
  );
}

const blank = (): Cue => ({ id: uid(), kind: "cue", num: "", dur: "01:00", title: "New segment", source: "", audio: "", cg: "", notes: "" });
const blankSection = (): Cue => ({ id: uid(), kind: "section", num: "", dur: "10:00", title: "New section", source: "", audio: "", cg: "", notes: "" });

export function Ros() {
  const { show, patch, patchEvent, add, remove, dup, setShow, canEdit, orgId } = useShow();
  const [modal, setModal] = React.useState<null | "msg" | "perf" | "import">(null);
  const [thread, setThread] = React.useState<string | null>(null);

  /* ---------- follow the live cue ---------- */
  const [follow, setFollow] = React.useState(true);
  React.useEffect(() => { try { setFollow(localStorage.getItem("pangeadock.follow") !== "0"); } catch {} }, []);
  const setFollowSaved = (b: boolean) => { setFollow(b); try { localStorage.setItem("pangeadock.follow", b ? "1" : "0"); } catch {} };
  const liveId = show.live.on ? show.cues[show.live.idx]?.id : undefined;

  /* ---------- drag & drop ---------- */
  const [drag, setDrag] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<{ id: string; pos: DropPos } | null>(null);
  /** Apply a new cue order and keep the live (on-air) cue pointing at the same row. */
  const applyOrder = (fn: (c: Cue[]) => Cue[]) =>
    setShow((s) => {
      const next = fn(s.cues);
      if (next === s.cues) return s;
      const liveId = s.cues[s.live.idx]?.id;
      const li = next.findIndex((c) => c.id === liveId);
      return { ...s, cues: next, live: { ...s.live, idx: li >= 0 ? li : s.live.idx } };
    });
  const dragging = drag ? blockRange(show.cues, drag) : null;
  const handle = (id: string) =>
    canEdit ? (
      <span
        draggable
        title="Drag to reorder"
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          const tr = (e.currentTarget as HTMLElement).closest("tr");
          if (tr) e.dataTransfer.setDragImage(tr, 24, 20);
          setDrag(id);
        }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        className="inline-grid h-6 w-5 shrink-0 cursor-grab place-items-center rounded text-fg-faint transition hover:bg-raise hover:text-fg active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </span>
    ) : null;
  const dropProps = (id: string) => ({
    onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => {
      if (!drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const r = e.currentTarget.getBoundingClientRect();
      const t = resolveDrop(show.cues, drag, id, e.clientY < r.top + r.height / 2 ? "before" : "after");
      if (t?.id !== over?.id || t?.pos !== over?.pos) setOver(t);
    },
    onDrop: (e: React.DragEvent<HTMLTableRowElement>) => {
      e.preventDefault();
      if (drag && over) applyOrder((c) => reorder(c, drag, over.id, over.pos));
      setDrag(null); setOver(null);
    },
  });
  const dropCls = (id: string, i: number) =>
    cx(
      over?.id === id && (over.pos === "before" ? "[&>td]:shadow-[inset_0_3px_0_rgb(var(--brand))]" : "[&>td]:shadow-[inset_0_-3px_0_rgb(var(--brand))]"),
      dragging && i >= dragging[0] && i <= dragging[1] && "opacity-40",
    );
  const times = computeTimes(show.cues, show.event.startTime);
  const total = times.length ? times[times.length - 1].end - (parseHMS(show.event.startTime) ?? 0) : 0;
  const idx = show.live.idx;
  const sources = ["", ...show.inputs.map((i) => i.label)];
  const [startDraft, setStartDraft] = React.useState(show.event.startTime);
  React.useEffect(() => setStartDraft(show.event.startTime), [show.event.startTime]);
  const startBad = parseHMS(startDraft) == null;
  const speakerCgs = show.speakers.map((s) => `LT: ${s.name}`);
  const mediaCgs = show.media.map((m) => `MEDIA: ${m.assetId} ${m.file}`);
  const pvwIdx = show.live.on ? nextPlayable(show.cues, idx) : -1;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  React.useEffect(() => {
    if (!follow || !liveId) return;
    // Open the section the live cue is in, then bring the row to the middle of the screen.
    const sec = times.find((r) => r.cue.id === liveId)?.sectionId;
    if (sec && collapsed.has(sec)) { setCollapsed((c) => { const n = new Set(c); n.delete(sec); return n; }); return; }
    const el = document.querySelector<HTMLElement>(`[data-cue-row="${liveId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [follow, liveId, collapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  const comments = show.comments ?? [];
  const openComments = comments.filter((c) => !c.resolved && show.cues.some((q) => q.id === c.cueId)).length;
  const cueCount = show.cues.filter((c) => c.kind !== "section").length;
  const secCount = show.cues.length - cueCount;

  return (
    <section>
      <SectionHead title="Live Run-of-Show & Technical Cue Sheet" accent="bg-pgm" sub={`${cueCount} cues${secCount ? ` · ${secCount} sections` : ""} · total ${fmtMS(total)} · ends ${times.length ? fmtHMS(times[times.length - 1].end) : "--"}`}>
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
        <button className="btn" onClick={() => add("cues", blankSection())} title="Header row with just a name and planned duration"><FolderPlus size={14} /> Add section</button>
        <button className="btn" onClick={() => add("cues", blank())}><Plus size={14} /> Add cue</button>
      </SectionHead>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ToolBtn active={follow} onClick={() => setFollowSaved(!follow)} title="Keep the on-air cue in view while the show runs"><Crosshair size={14} /> Follow live</ToolBtn>
        <ToolBtn href={orgId ? `/timer/${orgId}` : "/timer"} title="Full-screen presenter countdown for this production (opens a new tab, crew sign-in required)"><Timer size={14} /> Stage timer</ToolBtn>
        {canEdit && (
          <button className={cx("btn !py-1.5 text-xs", show.stageMsg && "!border-cg/50 !bg-cg/10")} onClick={() => setModal("msg")}>
            <Megaphone size={14} className={show.stageMsg ? "text-cg" : ""} /> Stage message
            {show.stageMsg && <span className="max-w-[160px] truncate font-semibold text-fg">· {show.stageMsg.text}</span>}
          </button>
        )}
        <ToolBtn onClick={() => setModal("perf")} title="As-run log: what went to air, when and who called it"><ScrollText size={14} /> Proof of performance{show.perfLog?.length ? <span className="text-fg-muted">· {show.perfLog.length}</span> : null}</ToolBtn>
        {openComments > 0 && <span className="text-xs text-fg-muted">{openComments} open comment{openComments === 1 ? "" : "s"}</span>}
        {canEdit && <button className="btn ml-auto !py-1.5 text-xs" onClick={() => setModal("import")}><FileSpreadsheet size={14} /> Import CSV / Sheets</button>}
      </div>
      <StageMsgModal open={modal === "msg"} onClose={() => setModal(null)} />
      <PerfLogModal open={modal === "perf"} onClose={() => setModal(null)} />
      <ImportCsvModal open={modal === "import"} onClose={() => setModal(null)} />
      <CommentThread cueId={thread} onClose={() => setThread(null)} />

      <datalist id="cg-options">{[...speakerCgs, ...mediaCgs].map((o) => <option key={o} value={o} />)}</datalist>
      <TableWrap>
        <thead>
          <tr>
            <th className="th w-[112px]">Tally</th>
            <th className="th w-[70px]">Cue #</th>
            <th className="th w-[96px]">Start</th>
            <th className="th w-[84px]">Duration</th>
            <th className="th min-w-[220px]">Segment / Action Title</th>
            <th className="th min-w-[170px]">Video / Switcher Source</th>
            <th className="th min-w-[210px]">Audio Cue</th>
            <th className="th min-w-[190px]">CG / Lower Third</th>
            <th className="th min-w-[240px]">TD &amp; Stage Notes</th>
            <th className="th w-[212px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {times.map((row, i) => {
            const { cue, start } = row;
            const isPgm = show.live.on && i === idx;
            const isPvw = show.live.on && i === pvwIdx;
            const past = show.live.on && i < idx;
            if (row.sectionId && collapsed.has(row.sectionId)) return null;
            if (row.isSection) {
              const diff = row.actualSec - row.plannedSec;
              const open = !collapsed.has(cue.id);
              const kids = times.filter((r) => r.sectionId === cue.id).length;
              return (
                <tr key={cue.id} data-cue-row={cue.id} {...dropProps(cue.id)} className={cx("border-t border-line bg-brand-soft/60", isPgm && "!bg-pgm/10", past && "opacity-45", dropCls(cue.id, i))}>
                  <td className={cx("td border-l-[3px] !align-middle", isPgm ? "border-l-pgm" : isPvw ? "border-l-pvw" : "border-l-brand")}>
                    <div className="flex items-center gap-1">
                    {handle(cue.id)}
                    {isPgm ? <Badge tone="red"><span className="h-1.5 w-1.5 animate-tally rounded-full bg-pgm" />On air</Badge>
                      : isPvw ? <Badge tone="green">Standby</Badge>
                      : row.hasChildren ? (
                        <button type="button" onClick={() => toggle(cue.id)} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-brand hover:bg-surface" title={open ? "Collapse section" : "Expand section"}>
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{open ? "" : `${kids}`}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="td !align-middle px-2"><span className="text-[10px] font-bold uppercase tracking-wider text-brand">Section</span></td>
                  <td className="td !align-middle px-2 font-mono text-[13px] font-semibold tabular-nums text-brand">{fmtHMS(start)}</td>
                  <td className="td"><DurationCell value={cue.dur} onChange={(v) => patch("cues", cue.id, { dur: v })} className="font-semibold" /></td>
                  <td className="td" colSpan={5}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Cell value={cue.title} onChange={(v) => patch("cues", cue.id, { title: v })} className="!w-auto min-w-[260px] flex-1 !text-[14px] font-semibold uppercase tracking-wide" placeholder="Section name" />
                      {row.hasChildren ? (
                        <span className="flex shrink-0 items-center gap-2 pr-2 text-xs text-fg-muted">
                          <span>{kids} cue{kids === 1 ? "" : "s"}</span>
                          <span className="font-mono">{fmtMS(row.actualSec)} / {fmtMS(row.plannedSec)}</span>
                          <Badge tone={diff > 0 ? "red" : diff < 0 ? "amber" : "green"}>{diff === 0 ? "on plan" : `${diff > 0 ? "+" : "−"}${fmtSigned(Math.abs(diff))} ${diff > 0 ? "over" : "under"}`}</Badge>
                        </span>
                      ) : (
                        <span className="shrink-0 pr-2 text-xs text-fg-muted">Timed block · ends {fmtHMS(row.end)}</span>
                      )}
                    </div>
                  </td>
                  <td className="td whitespace-nowrap">
                    <CommentBtn cue={cue} onOpen={setThread} />
                    <IconBtn title="Insert cue below" onClick={() => add("cues", blank(), cue.id)}><ListPlus size={15} /></IconBtn>
                    <IconBtn title="Move section (with its cues) up" disabled={i === 0} onClick={() => applyOrder((c) => moveBlock(c, cue.id, -1))}><ArrowUp size={15} /></IconBtn>
                    <IconBtn title="Move section (with its cues) down" disabled={blockRange(show.cues, cue.id)[1] === times.length - 1} onClick={() => applyOrder((c) => moveBlock(c, cue.id, 1))}><ArrowDown size={15} /></IconBtn>
                    <IconBtn title="Duplicate" onClick={() => dup("cues", cue.id)}><CopyPlus size={15} /></IconBtn>
                    <IconBtn title="Delete section (its cues stay)" danger onClick={() => remove("cues", cue.id)}><Trash2 size={15} /></IconBtn>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={cue.id} data-cue-row={cue.id} {...dropProps(cue.id)} className={cx("border-t border-line", isPgm && "bg-pgm/10", isPvw && "bg-pvw/[0.07]", past && "opacity-45", dropCls(cue.id, i))}>
                <td className={cx("td border-l-[3px] !align-middle", isPgm ? "border-l-pgm" : isPvw ? "border-l-pvw" : "border-l-transparent")}>
                  <div className="flex items-center gap-1">
                    {handle(cue.id)}
                    {isPgm && <Badge tone="red"><span className="h-1.5 w-1.5 animate-tally rounded-full bg-pgm" />PGM · On air</Badge>}
                    {isPvw && <Badge tone="green">PVW · Standby</Badge>}
                  </div>
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
                  <CommentBtn cue={cue} onOpen={setThread} />
                  <IconBtn title="Insert cue below" onClick={() => add("cues", blank(), cue.id)}><ListPlus size={15} /></IconBtn>
                  <IconBtn title="Insert section below" onClick={() => add("cues", blankSection(), cue.id)}><FolderPlus size={15} /></IconBtn>
                  <IconBtn title="Move up" disabled={i === 0} onClick={() => applyOrder((c) => reorder(c, cue.id, c[i - 1].id, "before"))}><ArrowUp size={15} /></IconBtn>
                  <IconBtn title="Move down" disabled={i === times.length - 1} onClick={() => applyOrder((c) => reorder(c, cue.id, c[i + 1].id, "after"))}><ArrowDown size={15} /></IconBtn>
                  <IconBtn title="Duplicate" onClick={() => dup("cues", cue.id)}><CopyPlus size={15} /></IconBtn>
                  <IconBtn title="Delete cue" danger onClick={() => remove("cues", cue.id)}><Trash2 size={15} /></IconBtn>
                </td>
              </tr>
            );
          })}
          {times.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-sm text-fg-muted">No cues. Add the first one.</td></tr>}
        </tbody>
      </TableWrap>
      <p className="mt-2 text-[11px] text-fg-muted">Start times recalculate from the Master Show Start and each row's duration. Reorder, insert or edit a duration and every following row updates. Drag the <GripVertical size={11} className="inline -mt-0.5" /> handle to reorder — a section moves with all its cues. Press <kbd className="rounded bg-raise px-1 font-mono">Space</kbd> in Live Show Mode to take the next cue, <kbd className="rounded bg-raise px-1 font-mono">Shift+Space</kbd> to go back. <b className="font-medium text-fg-soft">Sections</b> group the cues below them: with cues, their duration is the plan (actual vs plan shown on the header) and GO skips the header; an empty section (break, changeover) is a timed block that adds to the running time.</p>
    </section>
  );
}
