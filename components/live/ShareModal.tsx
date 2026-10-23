"use client";
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, ShieldCheck, Timer, ListOrdered } from "lucide-react";
import { useShow } from "@/lib/store";
import { Modal } from "../Modal";
import { cx } from "../ui";

/** Guest pass: a link (and QR) that shows the agenda / stage timer without an account. */
export function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show, isAdmin, call } = useShow();
  const share = show.share;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<"agenda" | "timer">("agenda");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = share?.token ? `${origin}/share/${share.token}${view === "timer" ? "?view=timer" : ""}` : "";

  useEffect(() => {
    if (!url) { setQr(""); return; }
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#111216", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [url]);

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(action); setErr("");
    try { await call("/api/share", { action, ...extra }); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };

  return (
    <Modal open={open} onClose={onClose} wide title="Guest pass" sub="A read-only link for talent, clients and venue staff. No account needed.">
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-raise/70 px-3 py-2.5 text-xs text-fg-soft">
        <ShieldCheck size={15} className="mt-px shrink-0 text-pvw" />
        <span>Guests see only the <b className="font-medium text-fg">agenda, live position, stage timer and stage messages</b>. Never stream keys, patch, gear, crew, RF plan, media links or comments.</span>
      </div>

      {!share?.token ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <Link2 size={22} className="mx-auto mb-2 text-fg-faint" />
          <p className="text-sm text-fg-soft">Guest link is off.</p>
          {isAdmin
            ? <button className="btn-primary mx-auto mt-3" disabled={!!busy} onClick={() => act("enable")}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Create guest link</button>
            : <p className="mt-1 text-xs text-fg-muted">Ask a production admin to turn it on.</p>}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex rounded-full border border-line p-0.5">
              {([["agenda", "Agenda", ListOrdered], ["timer", "Stage timer", Timer]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setView(id)} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", view === id ? "bg-inverse text-on-inverse" : "text-fg-muted hover:text-fg")}><Icon size={13} />{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-line bg-raise/50 px-3 py-2 font-mono text-[12px] text-fg outline-none" />
              <button className="btn shrink-0" onClick={copy}>{copied ? <Check size={14} className="text-pvw" /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
              <a className="btn shrink-0" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
            </div>
            {isAdmin && (
              <div className="space-y-2 border-t border-line pt-3">
                <label className="flex items-center gap-2 text-[13px] text-fg-soft">
                  <input type="checkbox" checked={!!share.showNotes} disabled={!!busy} onChange={(e) => act("settings", { showNotes: e.target.checked })} />
                  Include cue notes in the agenda
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="btn" disabled={!!busy} onClick={() => window.confirm("Make a new link? Anyone using the current link or QR will lose access.") && act("regenerate")}><RefreshCw size={13} className={busy === "regenerate" ? "animate-spin" : ""} /> New link</button>
                  <button className="btn !text-pgm" disabled={!!busy} onClick={() => window.confirm("Turn off the guest link? It stops working immediately.") && act("disable")}>Turn off</button>
                </div>
                {share.createdBy && <p className="text-[11px] text-fg-faint">Created by {share.createdBy}{share.createdAt ? ` · ${new Date(share.createdAt).toLocaleString()}` : ""}</p>}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="mx-auto grid aspect-square w-full max-w-[200px] place-items-center rounded-2xl border border-line bg-white p-2">
              {qr ? <img src={qr} alt="QR code for the guest link" className="h-full w-full" /> : <Loader2 size={18} className="animate-spin text-fg-faint" />}
            </div>
            {qr && <a href={qr} download={`guest-${view}-qr.png`} className="mt-2 inline-block text-xs font-medium text-brand hover:underline">Download QR</a>}
          </div>
        </div>
      )}
      {err && <p className="mt-3 text-xs text-pgm">{err}</p>}
    </Modal>
  );
}
