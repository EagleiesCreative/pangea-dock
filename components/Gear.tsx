"use client";
import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check as CheckIcon, FolderPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { uid, useShow } from "@/lib/store";
import { Badge, Cell, Check, IconBtn, Progress, SectionHead, cx } from "./ui";
import type { GearItem } from "@/lib/types";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function Gear() {
  const { show, add, patch, remove, setShow, canEdit } = useShow();
  const [missingOnly, setMissingOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const isMissing = (g: GearItem) => g.loaded && !g.out;
  const missingCount = show.gear.filter(isMissing).length;
  const total = show.gear.length;

  // Sections in the user's order, plus any category an item still uses that isn't in the list (never hide gear).
  const sections = [...show.gearCats, ...[...new Set(show.gear.map((g) => g.cat))].filter((c) => c && !show.gearCats.includes(c))];

  const addSection = (name: string) => setShow((s) => ({ ...s, gearCats: [...s.gearCats, name] }));
  const renameSection = (from: string, to: string) =>
    setShow((s) => ({
      ...s,
      gearCats: s.gearCats.includes(from) ? s.gearCats.map((c) => (c === from ? to : c)) : [...s.gearCats, to],
      gear: s.gear.map((g) => (g.cat === from ? { ...g, cat: to } : g)),
    }));
  const moveSection = (name: string, dir: -1 | 1) =>
    setShow((s) => {
      const list = s.gearCats.includes(name) ? [...s.gearCats] : [...s.gearCats, name];
      const i = list.indexOf(name), j = i + dir;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, gearCats: list };
    });
  const deleteSection = (name: string) => {
    const n = show.gear.filter((g) => g.cat === name).length;
    if (n && !window.confirm(`Delete “${name}” and its ${n} item${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    setShow((s) => ({ ...s, gearCats: s.gearCats.filter((c) => c !== name), gear: s.gear.filter((g) => g.cat !== name) }));
  };

  return (
    <div className="space-y-5">
      <SectionHead title="3-Stage Gear Inventory & Packing Tracker" accent="bg-vid" sub={`${total} items · ${sections.length} sections`}>
        <button className={cx("btn", missingOnly && "!border-cg !bg-cg/15 !text-cg")} onClick={() => setMissingOnly((m) => !m)} aria-pressed={missingOnly}>
          <AlertTriangle size={14} /> Missing at Strike / Pack-Out <Badge tone={missingCount ? "amber" : "green"}>{missingCount}</Badge>
        </button>
        <button className="btn" onClick={() => setAdding(true)} disabled={!canEdit}><FolderPlus size={14} /> Add section</button>
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

      {adding && (
        <SectionNameForm existing={sections} onCancel={() => setAdding(false)} onSave={(name) => { addSection(name); setAdding(false); }} placeholder="e.g. Lighting, Drone & Aerial, Spares…" />
      )}

      {sections.map((cat, idx) => {
        const all = show.gear.filter((g) => g.cat === cat);
        const items = missingOnly ? all.filter(isMissing) : all;
        if (missingOnly && !items.length) return null;
        const done = all.reduce((a, g) => a + +g.packed + +g.loaded + +g.out, 0);
        const p = pct(done, all.length * 3);
        return (
          <section key={cat} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
              <SectionTitle name={cat} count={all.length} existing={sections} canEdit={canEdit} onRename={(to) => renameSection(cat, to)} />
              <div className="flex w-56 items-center gap-2"><Progress pct={p} color={p === 100 ? "bg-pvw" : "bg-vid"} /><span className="w-9 text-right font-mono text-xs text-fg-soft">{p}%</span></div>
              <div className="flex items-center gap-1">
                <IconBtn title="Move section up" disabled={!canEdit || idx === 0} onClick={() => moveSection(cat, -1)}><ArrowUp size={15} /></IconBtn>
                <IconBtn title="Move section down" disabled={!canEdit || idx === sections.length - 1} onClick={() => moveSection(cat, 1)}><ArrowDown size={15} /></IconBtn>
                <IconBtn title="Delete section" danger disabled={!canEdit} onClick={() => deleteSection(cat)}><Trash2 size={15} /></IconBtn>
                <button className="btn ml-1 !py-1" disabled={!canEdit} onClick={() => add("gear", { id: uid(), cat, name: "", qty: 1, tag: "", notes: "", packed: false, loaded: false, out: false } as GearItem)}><Plus size={13} /> Add item</button>
              </div>
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
                  {items.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-sm text-fg-muted">No items yet — use “Add item”.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {!missingOnly && (
        adding ? null : (
          <button disabled={!canEdit} onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-4 text-sm font-medium text-fg-muted transition hover:border-brand/40 hover:bg-brand-soft/40 hover:text-brand disabled:pointer-events-none disabled:opacity-40">
            <FolderPlus size={16} /> Add a new section
          </button>
        )
      )}
      {missingOnly && missingCount === 0 && <div className="card p-8 text-center text-sm text-pvw">Nothing missing — every item loaded in has been packed out.</div>}
    </div>
  );
}

function useNameCheck(existing: string[], current?: string) {
  return (raw: string) => {
    const v = raw.trim();
    if (!v) return "Give the section a name.";
    if (existing.some((c) => c.toLowerCase() === v.toLowerCase() && c !== current)) return "A section with that name already exists.";
    return "";
  };
}

function SectionNameForm({ existing, onSave, onCancel, placeholder }: { existing: string[]; onSave: (n: string) => void; onCancel: () => void; placeholder?: string }) {
  const [name, setName] = useState("");
  const check = useNameCheck(existing);
  const err = name ? check(name) : "";
  return (
    <form className="card flex flex-wrap items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (!check(name)) onSave(name.trim()); }}>
      <FolderPlus size={16} className="text-brand" />
      <input autoFocus className="cell min-w-[240px] flex-1 border-line !text-sm" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onCancel()} />
      <button type="submit" className="btn-primary !py-1.5" disabled={!!check(name)}>Create section</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      {err && <span className="w-full text-xs text-pgm">{err}</span>}
    </form>
  );
}

function SectionTitle({ name, count, existing, canEdit, onRename }: { name: string; count: number; existing: string[]; canEdit: boolean; onRename: (to: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const check = useNameCheck(existing, name);
  const err = check(draft);
  const commit = () => { if (!err && draft.trim() !== name) onRename(draft.trim()); setEditing(false); };
  if (editing)
    return (
      <div className="flex items-center gap-1.5">
        <input autoFocus className={cx("cell w-64 border-line !text-sm font-semibold", err && "!border-pgm")} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(name); setEditing(false); } }} title={err || undefined} />
        <IconBtn title="Save name" disabled={!!err} onClick={commit}><CheckIcon size={15} /></IconBtn>
        <IconBtn title="Cancel" onClick={() => { setDraft(name); setEditing(false); }}><X size={15} /></IconBtn>
      </div>
    );
  return (
    <div className="group flex items-center gap-2">
      <h3 className="text-sm font-semibold text-fg">{name}</h3>
      <span className="font-mono text-xs text-fg-muted">{count} items</span>
      {canEdit && <button title="Rename section" onClick={() => setEditing(true)} className="rounded-md p-1 text-fg-faint opacity-60 transition hover:bg-raise hover:text-fg group-hover:opacity-100"><Pencil size={13} /></button>}
    </div>
  );
}
