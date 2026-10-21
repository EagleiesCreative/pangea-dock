"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Rendered into <body> via a portal so parents with backdrop-filter/transform can't trap or squash it. */
export function Modal({ open, onClose, title, sub, children, wide }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="no-print fixed inset-0 z-[90] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`card relative max-h-[88vh] w-full overflow-hidden shadow-2xl ${wide ? "max-w-[720px]" : "max-w-md"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-fg-muted">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-fg-muted transition hover:bg-raise hover:text-fg"><X size={16} /></button>
        </div>
        <div className="max-h-[calc(88vh-72px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
