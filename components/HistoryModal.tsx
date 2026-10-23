"use client";
import React, { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useShow } from "@/lib/store";
import { Modal } from "./Modal";
import { Badge } from "./ui";

type Entry = { id: string; version: number; by: string; at: string; startedAt: string; sections: string[]; note?: string | null };

const LABEL: Record<string, string> = {
  event: "Event details", cues: "Run-of-show", cameras: "Camera plot", inputs: "Input patch", outputs: "Output patch", vault: "Stream vault",
  media: "Media", speakers: "Lower thirds", gear: "Gear", gearCats: "Gear sections", qc: "QC checklist", siteMap: "Site & RF plan", siteImage: "Floor plan image",
};
const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Who changed what, and a one-click way to put sections back the way they were. */
export function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call, canEdit } = useShow();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try { const j = await call<{ entries: Entry[]; error?: string }>("/api/history"); setEntries(j.entries); if (j.error) setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setEntries([]); }
  }, [call]);
  useEffect(() => { if (open) { setEntries(null); setDone(""); load(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async (e: Entry) => {
    const what = e.sections.map((s) => LABEL[s] ?? s).join(", ");
    if (!window.confirm(`Put ${what} back to how it was before ${e.by}'s change (${ago(e.startedAt)})?\n\nLater edits to these sections will be replaced. This restore is itself recorded, so you can undo it.`)) return;
    setBusy(e.id); setErr("");
    try { await call("/api/history", { action: "restore", id: e.id }); setDone(`Restored ${what}.`); await load(); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Version history" sub="Edits are grouped into bursts per person. Restoring puts those sections back to how they were before that edit.">
      {err && <p className="mb-3 rounded-xl bg-cg/10 px-3 py-2 text-xs text-fg">{err}</p>}
      {done && <p className="mb-3 rounded-xl bg-pvw/10 px-3 py-2 text-xs text-pvw">{done}</p>}
      {entries === null ? (
        <div className="grid place-items-center py-10 text-fg-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center text-sm text-fg-muted"><History size={20} className="mx-auto mb-2 text-fg-faint" />No history yet — it starts with the next edit.</div>
      ) : (
        <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-line">
          {entries.map((e, i) => (
            <li key={e.id} className="relative flex items-start gap-3 rounded-xl px-1 py-2 hover:bg-raise/60">
              <span className={`relative z-10 mt-1 h-[9px] w-[9px] shrink-0 translate-x-[7px] rounded-full ring-4 ring-surface ${i === 0 ? "bg-brand" : "bg-line-strong"}`} />
              <div className="ml-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span className="font-medium text-fg">{e.by}</span>
                  <span className="text-fg-muted">{e.note ? e.note.toLowerCase() : "edited"}</span>
                  {e.sections.map((s) => <Badge key={s}>{LABEL[s] ?? s}</Badge>)}
                </div>
                <div className="mt-0.5 text-[11px] text-fg-faint">{ago(e.at)}{e.startedAt !== e.at ? ` · started ${ago(e.startedAt)}` : ""} · v{e.version}</div>
              </div>
              {canEdit && (
                <button className="btn shrink-0 !py-1 text-xs" disabled={!!busy} onClick={() => restore(e)} title="Restore these sections to before this edit">
                  {busy === e.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restore
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
