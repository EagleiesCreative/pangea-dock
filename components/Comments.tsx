"use client";
import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, CircleDot, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { useShow } from "@/lib/store";
import { Modal } from "./Modal";
import { cx } from "./ui";
import type { Cue } from "@/lib/types";

/**
 * Comment button for a cue row. It's an <a>, not a <button>, so it keeps working for viewers inside the
 * read-only <fieldset disabled> — anyone on the production can comment.
 */
export function CommentBtn({ cue, onOpen }: { cue: Cue; onOpen: (id: string) => void }) {
  const { show } = useShow();
  const list = (show.comments ?? []).filter((c) => c.cueId === cue.id);
  const open = list.filter((c) => !c.resolved).length;
  return (
    <a
      href="#"
      role="button"
      title={list.length ? `${open} open · ${list.length} total comments` : "Comment"}
      onClick={(e) => { e.preventDefault(); onOpen(cue.id); }}
      className={cx(
        "relative inline-grid h-7 w-7 place-items-center rounded-lg align-middle transition hover:bg-raise",
        open ? "text-brand" : list.length ? "text-fg-muted" : "text-fg-faint hover:text-fg",
      )}
    >
      <MessageSquare size={15} />
      {open > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9.5px] font-semibold leading-none text-white">{open}</span>}
    </a>
  );
}

export function CommentThread({ cueId, onClose }: { cueId: string | null; onClose: () => void }) {
  const { show, call, canEdit } = useShow();
  const { user } = useUser();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const cue = show.cues.find((c) => c.id === cueId);
  const list = (show.comments ?? []).filter((c) => c.cueId === cueId).sort((a, b) => a.at - b.at);

  const act = async (key: string, body: Record<string, unknown>) => {
    setBusy(key); setErr("");
    try { await call("/api/comment", body); return true; } catch (e) { setErr(e instanceof Error ? e.message : String(e)); return false; } finally { setBusy(null); }
  };

  return (
    <Modal open={!!cueId} onClose={onClose} title={cue ? `${cue.num ? cue.num + " · " : ""}${cue.title || "Untitled"}` : "Comments"} sub="Notes for the crew on this cue. Visible to everyone in the production, never to guests.">
      <div className="space-y-2">
        {list.map((c) => {
          const mine = c.byId === user?.id;
          return (
            <div key={c.id} className={cx("rounded-xl border px-3 py-2.5", c.resolved ? "border-line bg-raise/40 opacity-70" : "border-line bg-surface")}>
              <div className="flex items-center gap-2 text-[11.5px]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand">{c.by.slice(0, 1).toUpperCase()}</span>
                <span className="font-medium text-fg">{c.by}</span>
                <span className="text-fg-faint">{new Date(c.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="ml-auto flex items-center gap-0.5">
                  {(mine || canEdit) && (
                    <button title={c.resolved ? "Reopen" : "Resolve"} disabled={!!busy} onClick={() => act(c.id, { action: "resolve", id: c.id, resolved: !c.resolved })} className="rounded-md p-1 text-fg-muted hover:bg-raise hover:text-pvw">
                      {c.resolved ? <CircleDot size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  )}
                  {(mine || canEdit) && (
                    <button title="Delete" disabled={!!busy} onClick={() => window.confirm("Delete this comment?") && act(c.id, { action: "delete", id: c.id })} className="rounded-md p-1 text-fg-muted hover:bg-raise hover:text-pgm"><Trash2 size={14} /></button>
                  )}
                </span>
              </div>
              <p className={cx("mt-1.5 whitespace-pre-wrap text-[13px] text-fg", c.resolved && "line-through decoration-fg-faint")}>{c.text}</p>
            </div>
          );
        })}
        {!list.length && <p className="py-4 text-center text-sm text-fg-muted">No comments yet.</p>}
      </div>
      <form className="mt-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await act("add", { action: "add", cueId, text }))) setText(""); }}>
        <textarea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }}
          className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-fg-faint">⌘/Ctrl + Enter to send</span>
          <button type="submit" className="btn-primary !py-1.5" disabled={!text.trim() || busy === "add"}>{busy === "add" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Comment</button>
        </div>
        {err && <p className="text-xs text-pgm">{err}</p>}
      </form>
    </Modal>
  );
}
