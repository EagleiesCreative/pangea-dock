"use client";
import React, { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { uid, useShow } from "@/lib/store";
import { Badge, Cell, Check, IconBtn, Progress, SectionHead, cx } from "./ui";
import type { GearCategory, GearItem } from "@/lib/types";

export const GEAR_CATS: GearCategory[] = [
  "Cameras & Optics", "Video Switching & Capture", "Audio & Intercom (Comms)", "SDI / Fiber / Network Cabling", "Power, UPS & Rigging",
];
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function Gear() {
  const { show, add, patch, remove } = useShow();
  const [missingOnly, setMissingOnly] = useState(false);
  const isMissing = (g: GearItem) => g.loaded && !g.out;
  const missingCount = show.gear.filter(isMissing).length;
  const total = show.gear.length;

  return (
    <div className="space-y-5">
      <SectionHead title="3-Stage Gear Inventory & Packing Tracker" accent="bg-vid" sub={`${total} items`}>
        <button className={cx("btn", missingOnly && "!border-cg !bg-cg/15 !text-cg")} onClick={() => setMissingOnly((m) => !m)} aria-pressed={missingOnly}>
          <AlertTriangle size={14} /> Missing at Strike / Pack-Out <Badge tone={missingCount ? "amber" : "green"}>{missingCount}</Badge>
        </button>
      </SectionHead>

      <div className="grid gap-3 md:grid-cols-3">
        {([["packed", "Packed at Warehouse", "bg-vid"], ["loaded", "Loaded In at Venue", "bg-aud"], ["out", "Packed Out (Post-Show)", "bg-med"]] as const).map(([k, label, color]) => {
          const n = show.gear.filter((g) => g[k]).length;
          return (
            <div key={k} className="card p-3">
              <div className="mb-1.5 flex items-baseline justify-between"><span className="label">{label}</span><span className="font-mono text-sm text-fg">{n}/{total} · {pct(n, total)}%</span></div>
              <Progress pct={pct(n, total)} color={color} />
            </div>
          );
        })}
      </div>

      {GEAR_CATS.map((cat) => {
        const all = show.gear.filter((g) => g.cat === cat);
        const items = missingOnly ? all.filter(isMissing) : all;
        if (missingOnly && !items.length) return null;
        const done = all.reduce((a, g) => a + +g.packed + +g.loaded + +g.out, 0);
        const p = pct(done, all.length * 3);
        return (
          <section key={cat} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-fg">{cat}</h3>
                <span className="font-mono text-xs text-fg-muted">{all.length} items</span>
              </div>
              <div className="flex w-56 items-center gap-2"><Progress pct={p} color={p === 100 ? "bg-pvw" : "bg-vid"} /><span className="w-9 text-right font-mono text-xs text-fg-soft">{p}%</span></div>
              <button className="btn !py-1" onClick={() => add("gear", { id: uid(), cat, name: "", qty: 1, tag: "", notes: "", packed: false, loaded: false, out: false } as GearItem)}><Plus size={13} /> Add item</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead><tr>
                  <th className="th min-w-[240px]">Item</th><th className="th w-[64px]">Qty</th><th className="th w-[160px]">Serial / Asset Tag</th><th className="th min-w-[200px]">Notes</th>
                  <th className="th w-[96px] text-center">Packed</th><th className="th w-[96px] text-center">Loaded In</th><th className="th w-[96px] text-center">Packed Out</th><th className="th w-[44px]" />
                </tr></thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.id} className={cx("border-t border-line", isMissing(g) && "bg-cg/[0.06]")}>
                      <td className="td"><Cell value={g.name} onChange={(v) => patch("gear", g.id, { name: v })} placeholder="Item" /></td>
                      <td className="td"><Cell mono type="number" value={g.qty} onChange={(v) => patch("gear", g.id, { qty: Math.max(0, +v || 0) })} align="right" /></td>
                      <td className="td"><Cell mono value={g.tag} onChange={(v) => patch("gear", g.id, { tag: v })} placeholder="TAG-001" /></td>
                      <td className="td"><Cell value={g.notes} onChange={(v) => patch("gear", g.id, { notes: v })} className="text-fg-soft" /></td>
                      <td className="td text-center !align-middle"><Check checked={g.packed} onChange={(b) => patch("gear", g.id, { packed: b })} label="Packed at warehouse" /></td>
                      <td className="td text-center !align-middle"><Check checked={g.loaded} onChange={(b) => patch("gear", g.id, { loaded: b })} color="accent-aud" label="Loaded in at venue" /></td>
                      <td className="td text-center !align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          <Check checked={g.out} onChange={(b) => patch("gear", g.id, { out: b })} color="accent-med" label="Packed out" />
                          {isMissing(g) && <span title="Loaded in but not packed out"><AlertTriangle size={13} className="text-cg" /></span>}
                        </div>
                      </td>
                      <td className="td !align-middle"><IconBtn title="Delete item" danger onClick={() => remove("gear", g.id)}><Trash2 size={15} /></IconBtn></td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-sm text-fg-muted">No items.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {missingOnly && missingCount === 0 && <div className="card p-8 text-center text-sm text-pvw">Nothing missing — every item loaded in has been packed out.</div>}
    </div>
  );
}
