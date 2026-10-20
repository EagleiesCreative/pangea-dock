import React from "react";
import { Radio } from "lucide-react";

/** Centered branded frame for sign-in / sign-up / workspace picker. */
export function AuthShell({ children, title, sub }: { children: React.ReactNode; title?: string; sub?: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-inverse text-on-inverse"><Radio size={18} /></span>
          <div>
            <div className="text-base font-semibold leading-tight text-fg">Pangea Dock</div>
            <div className="text-[11px] text-fg-muted">Broadcast TD Command Center</div>
          </div>
        </div>
        {title && <h1 className="mb-1 text-center text-lg font-semibold text-fg">{title}</h1>}
        {sub && <p className="mb-5 max-w-sm text-center text-sm text-fg-muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
