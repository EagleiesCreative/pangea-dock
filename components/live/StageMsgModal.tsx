"use client";
import React, { useState } from "react";
import { Megaphone, Send, X } from "lucide-react";
import { useShow } from "@/lib/store";
import { Modal } from "../Modal";
import { cx } from "../ui";
import type { StageMsg } from "@/lib/types";

const PRESETS: { text: string; tone: StageMsg["tone"]; flash?: boolean }[] = [
  { text: "WRAP UP", tone: "warn" },
  { text: "30 SECONDS", tone: "warn" },
  { text: "STRETCH", tone: "info" },
  { text: "SLOW DOWN", tone: "info" },
  { text: "LOOK AT CAMERA", tone: "info" },
  { text: "STOP NOW", tone: "urgent", flash: true },
];
const TONES: { id: StageMsg["tone"]; label: string; cls: string }[] = [
  { id: "info", label: "Info", cls: "bg-surface text-fg border-line" },
  { id: "warn", label: "Warning", cls: "bg-cg/15 text-cg border-cg/40" },
  { id: "urgent", label: "Urgent", cls: "bg-pgm/10 text-pgm border-pgm/40" },
];

/** Send a message to every stage timer / guest screen. */
export function StageMsgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show, sendStageMsg, canEdit } = useShow();
  const [text, setText] = useState("");
  const [tone, setTone] = useState<StageMsg["tone"]>("info");
  const [flash, setFlash] = useState(false);
  const cur = show.stageMsg;
  const send = (m: { text: string; tone: StageMsg["tone"]; flash?: boolean }) => {
    const t = m.text.trim().slice(0, 140);
    if (t) sendStageMsg({ text: t, tone: m.tone, flash: !!m.flash, at: 0 });
  };

  return (
    <Modal open={open} onClose={onClose} title="Stage message" sub="Appears on every stage timer and guest screen right away.">
      <div className="space-y-4">
        <div className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5", cur ? "border-brand/30 bg-brand-soft" : "border-dashed border-line")}>
          <Megaphone size={16} className={cur ? "text-brand" : "text-fg-faint"} />
          <div className="min-w-0 flex-1">
            <div className="label">{cur ? "Showing now" : "Nothing showing"}</div>
            {cur && <div className="truncate text-sm font-semibold text-fg">{cur.text}</div>}
            {cur?.by && <div className="text-[11px] text-fg-muted">by {cur.by}</div>}
          </div>
          {cur && <button className="btn !py-1" disabled={!canEdit} onClick={() => sendStageMsg(null)}><X size={13} /> Clear</button>}
        </div>

        <div>
          <div className="label mb-1.5">Quick send</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button key={p.text} disabled={!canEdit} onClick={() => send(p)}
                className={cx("rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold tracking-wide transition hover:brightness-95 disabled:opacity-50", TONES.find((t) => t.id === p.tone)!.cls)}>
                {p.text}
              </button>
            ))}
          </div>
        </div>

        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); send({ text, tone, flash }); setText(""); }}>
          <div className="label">Custom message</div>
          <input className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20" maxLength={140} placeholder="e.g. Skip the Q&A, go to video" value={text} onChange={(e) => setText(e.target.value)} disabled={!canEdit} />
          <div className="flex flex-wrap items-center gap-2">
            {TONES.map((t) => (
              <button type="button" key={t.id} onClick={() => setTone(t.id)} aria-pressed={tone === t.id}
                className={cx("rounded-full border px-3 py-1 text-xs font-medium", tone === t.id ? t.cls + " ring-2 ring-brand/25" : "border-line text-fg-muted")}>{t.label}</button>
            ))}
            <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-fg-soft"><input type="checkbox" checked={flash} onChange={(e) => setFlash(e.target.checked)} /> Flash</label>
            <button type="submit" className="btn-primary ml-auto !py-1.5" disabled={!canEdit || !text.trim()}><Send size={13} /> Send</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
