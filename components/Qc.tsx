"use client";
import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { uid, useShow } from "@/lib/store";
import { Badge, Check, Cell, IconBtn, Progress, SectionHead, cx } from "./ui";
import type { QcDept, QcItem } from "@/lib/types";

const DEPTS: { dept: QcDept; color: string; text: string }[] = [
  { dept: "Video & Color QC", color: "bg-vid", text: "text-vid" },
  { dept: "Audio & Comms QC", color: "bg-aud", text: "text-aud" },
  { dept: "Network, Stream & Recording QC", color: "bg-med", text: "text-med" },
];

export function Qc() {
  const { show, add, patch, remove } = useShow();
  const done = show.qc.filter((q) => q.done).length;
  const total = show.qc.length;
  const all = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <SectionHead title="Pre-Flight Tech Rehearsal & Signal QC Checklist" accent="bg-pvw" sub={`${done}/${total} signed off`}>
        <Badge tone={all === 100 ? "green" : all >= 50 ? "amber" : "red"}>{all === 100 ? "CLEARED FOR AIR" : `${all}% complete`}</Badge>
      </SectionHead>
      <div className="card p-3"><Progress pct={all} color={all === 100 ? "bg-pvw" : "bg-cg"} /></div>

      <div className="grid gap-4 xl:grid-cols-3">
        {DEPTS.map(({ dept, color, text }) => {
          const items = show.qc.filter((q) => q.dept === dept);
          const d = items.filter((i) => i.done).length;
          const p = items.length ? Math.round((d / items.length) * 100) : 0;
          return (
            <section key={dept} className="card flex flex-col">
              <div className="border-b border-line px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between"><h3 className={cx("text-sm font-semibold", text)}>{dept}</h3><span className="font-mono text-xs text-fg-soft">{d}/{items.length} · {p}%</span></div>
                <Progress pct={p} color={p === 100 ? "bg-pvw" : color} />
              </div>
              <ul className="flex-1 divide-y divide-line">
                {items.map((q) => (
                  <li key={q.id} className="flex items-start gap-2 px-3 py-2">
                    <span className="mt-1"><Check checked={q.done} onChange={(b) => patch("qc", q.id, { done: b })} color="accent-pvw" label={q.text} /></span>
                    <div className={cx("flex-1", q.done && "opacity-50")}><Cell value={q.text} onChange={(v) => patch("qc", q.id, { text: v })} className={cx(q.done && "line-through")} /></div>
                    <IconBtn title="Delete check" danger onClick={() => remove("qc", q.id)}><Trash2 size={14} /></IconBtn>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line p-2">
                <button className="btn w-full justify-center" onClick={() => add("qc", { id: uid(), dept, text: "New check", done: false } as QcItem)}><Plus size={13} /> Add check</button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
