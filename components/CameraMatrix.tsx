"use client";
import React, { useRef, useState } from "react";
import { Copy, Eye, EyeOff, Plus, Trash2, Video } from "lucide-react";
import { uid, useShow } from "@/lib/store";
import { Badge, Cell, Check, IconBtn, SectionHead, Sel, TableWrap, cx } from "./ui";
import type { Camera, InputRow, OutputRow, SignalStatus, SignalType } from "@/lib/types";

const MOUNTS = ["Tripod", "Gimbal", "Jib", "Handheld", "Pedestal", "Fixed / PTZ"];
const COMMS = ["Ch A", "Ch B", "Ch C"];
const SIG: SignalType[] = ["3G-SDI", "HDMI", "NDI", "SRT"];
const STAT: SignalStatus[] = ["Locked", "No Signal", "Testing"];
const OUT_PORTS = ["PGM", "Clean Feed", "Aux 1", "Aux 2", "Aux 3", "Aux 4", "Multiview"];
const DESTS = ["Stream Encoder", "Venue LED Wall", "Stage DSM", "HyperDeck ISO"];
const RES = ["1080p50", "1080p59.94", "1080p60", "1080i50", "720p50", "2160p50"];

export function CameraMatrix() {
  return (
    <div className="space-y-8">
      <CameraPlot />
      <PatchMatrix />
    </div>
  );
}

/* ---------------- 2D Camera Plot ---------------- */
function CameraPlot() {
  const { show, add, patch, remove, canEdit } = useShow();
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<string | null>(show.cameras[0]?.id ?? null);
  const drag = useRef<string | null>(null);
  const cam = show.cameras.find((c) => c.id === sel) ?? null;
  const used = new Set(show.cameras.map((c) => c.label));
  const nextLabel = [1, 2, 3, 4, 5, 6].map((n) => `CAM ${n}`).find((l) => !used.has(l));

  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.max(14, Math.min(986, p.x)), y: Math.max(14, Math.min(586, p.y)) };
  };
  const addCam = () => {
    if (!nextLabel) return;
    const c: Camera = { id: uid(), label: nextLabel, x: 500, y: 330, operator: "", body: "", lens: "", mount: "Tripod", framing: "", cable: "", comms: "Ch A", tally: `T${nextLabel.slice(-1)}` };
    add("cameras", c);
    setSel(c.id);
  };
  const f = (k: keyof Camera) => (v: string) => cam && patch("cameras", cam.id, { [k]: v });

  return (
    <section>
      <SectionHead title="Interactive 2D Stage & Camera Floorplan" accent="bg-vid" sub="Drag pins to plot · click to inspect">
        <button className="btn" onClick={addCam} disabled={!nextLabel}><Plus size={14} /> Add camera {nextLabel ? `(${nextLabel})` : "(max 6)"}</button>
      </SectionHead>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card p-2">
          <svg ref={svgRef} viewBox="0 0 1000 600" className="w-full touch-none select-none rounded-xl bg-canvas"
            onPointerMove={(e) => { if (drag.current) { const p = toSvg(e); patch("cameras", drag.current, p); } }}
            onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" className="stroke-line" strokeWidth="1" /></pattern>
              <pattern id="seats" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="2.5" className="fill-line-strong" /></pattern>
            </defs>
            <rect width="1000" height="600" fill="url(#grid)" />
            {/* Stage */}
            <rect x="180" y="30" width="640" height="230" rx="18" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
            <text x="500" y="248" textAnchor="middle" className="fill-fg-faint" fontSize="11" fontWeight="500" letterSpacing="4">STAGE</text>
            <rect x="240" y="44" width="520" height="20" rx="10" className="fill-vid/10 stroke-vid/40" />
            <text x="500" y="58" textAnchor="middle" className="fill-vid" fontSize="10" fontWeight="500" letterSpacing="3">LED MAIN WALL</text>
            <rect x="462" y="128" width="76" height="46" rx="10" className="fill-cg/10 stroke-cg/50" />
            <text x="500" y="155" textAnchor="middle" className="fill-cg" fontSize="10" fontWeight="500">PODIUM</text>
            <rect x="290" y="226" width="56" height="14" rx="7" className="fill-med/10 stroke-med/50" />
            <rect x="654" y="226" width="56" height="14" rx="7" className="fill-med/10 stroke-med/50" />
            <text x="318" y="220" textAnchor="middle" className="fill-med" fontSize="9" fontWeight="500">DSM</text>
            <text x="682" y="220" textAnchor="middle" className="fill-med" fontSize="9" fontWeight="500">DSM</text>
            {/* Audience */}
            <rect x="120" y="290" width="760" height="190" rx="18" fill="url(#seats)" className="stroke-line-strong" strokeDasharray="6 6" />
            <text x="500" y="312" textAnchor="middle" className="fill-fg-faint" fontSize="11" fontWeight="500" letterSpacing="4">AUDIENCE</text>
            {/* FOH */}
            <rect x="380" y="520" width="240" height="56" rx="14" className="fill-aud/10 stroke-aud/50" />
            <text x="500" y="544" textAnchor="middle" className="fill-aud" fontSize="11" fontWeight="600" letterSpacing="2">FOH / BROADCAST BOOTH</text>
            <text x="500" y="561" textAnchor="middle" className="fill-fg-muted" fontSize="9">TD · Switcher · Audio</text>
            {/* Cameras */}
            {show.cameras.map((c) => {
              const on = c.id === sel;
              return (
                <g key={c.id} transform={`translate(${c.x} ${c.y})`} className={canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                  onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId); if (canEdit) drag.current = c.id; setSel(c.id); }}>
                  {/* Field of view hint toward the stage */}
                  <path d="M0 0 L-26 -46 L26 -46 Z" className="fill-vid" fillOpacity={on ? 0.16 : 0.07} transform={c.y > 300 ? "" : "rotate(180)"} />
                  {on && <circle r="27" fill="none" className="stroke-vid/40" strokeDasharray="4 4" />}
                  <circle r="20" className={on ? "fill-vid stroke-vid" : "fill-surface stroke-vid/60"} strokeWidth={1.5} />
                  <text y="4" textAnchor="middle" className={on ? "fill-surface" : "fill-vid"} fontSize="11" fontWeight="600" fontFamily="JetBrains Mono, monospace">{c.label.replace("CAM ", "C")}</text>
                  <text y="38" textAnchor="middle" className="fill-fg-muted" fontSize="10" fontWeight="500">{c.operator || c.label}</text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-2 px-1 text-[11px] text-fg-muted">
            <Badge tone="cyan">Camera</Badge><Badge tone="amber">Podium</Badge><Badge tone="violet">DSM</Badge><Badge tone="teal">FOH</Badge>
          </div>
        </div>

        {/* Inspector */}
        <aside className="card p-3">
          {cam ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Video size={16} className="text-vid" /><span className="font-mono text-base font-bold text-vid">{cam.label}</span></div>
                <IconBtn title="Remove camera" danger onClick={() => { remove("cameras", cam.id); setSel(null); }}><Trash2 size={15} /></IconBtn>
              </div>
              <Field label="Operator Name"><Cell value={cam.operator} onChange={f("operator")} className="border-line" /></Field>
              <Field label="Camera Body"><Cell value={cam.body} onChange={f("body")} className="border-line" /></Field>
              <Field label="Lens Focal Length"><Cell mono value={cam.lens} onChange={f("lens")} placeholder="70-200mm f/2.8" className="border-line" /></Field>
              <Field label="Mounting"><Sel value={cam.mount} options={MOUNTS} onChange={f("mount")} className="border-line" /></Field>
              <Field label="Framing Assignment"><Cell value={cam.framing} onChange={f("framing")} className="border-line" /></Field>
              <Field label="Cable Type & Length"><Cell mono value={cam.cable} onChange={f("cable")} placeholder="80m 3G-SDI" className="border-line" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Comms Channel"><Sel value={cam.comms} options={COMMS} onChange={f("comms")} className="border-line" /></Field>
                <Field label="Tally ID"><Cell mono value={cam.tally} onChange={f("tally")} className="border-line" /></Field>
              </div>
              <p className="font-mono text-[10px] text-fg-faint">pos {Math.round(cam.x)}, {Math.round(cam.y)}</p>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-fg-muted">Select a camera pin to edit its details.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label mb-0.5 block">{label}</span>{children}</label>;
}

/* ---------------- Patch Matrix ---------------- */
function PatchMatrix() {
  const { show, add, patch, remove, patchVault } = useShow();
  const addInput = () => {
    const taken = new Set(show.inputs.map((i) => i.num));
    const n = Array.from({ length: 12 }, (_, i) => i + 1).find((x) => !taken.has(x));
    if (!n) return;
    const r: InputRow = { id: uid(), num: n, label: "", type: "3G-SDI", res: show.event.format, ip: "—", audio: false, status: "Testing" };
    add("inputs", r);
  };
  const addOutput = () => add("outputs", { id: uid(), port: "Aux 4", dest: "", res: show.event.format, cg: false } as OutputRow);
  const sortedInputs = [...show.inputs].sort((a, b) => a.num - b.num);
  const tone = (s: SignalStatus) => (s === "Locked" ? "green" : s === "Testing" ? "amber" : "red");

  return (
    <section className="space-y-6">
      <div>
        <SectionHead title="Switcher Inputs" accent="bg-vid" sub={`${show.inputs.length}/12 patched`}>
          <button className="btn" onClick={addInput} disabled={show.inputs.length >= 12}><Plus size={14} /> Add input</button>
        </SectionHead>
        <TableWrap>
          <thead><tr>
            <th className="th w-[64px]">In #</th><th className="th min-w-[180px]">Source Label</th><th className="th w-[110px]">Signal</th>
            <th className="th w-[120px]">Res &amp; FPS</th><th className="th min-w-[240px]">Static IP / NDI Name</th><th className="th w-[80px]">Embed Audio</th>
            <th className="th w-[130px]">Status</th><th className="th w-[44px]" />
          </tr></thead>
          <tbody>
            {sortedInputs.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="td"><Cell mono type="number" value={r.num} onChange={(v) => patch("inputs", r.id, { num: Math.min(12, Math.max(1, +v || 1)) })} className="text-vid font-bold" /></td>
                <td className="td"><Cell value={r.label} onChange={(v) => patch("inputs", r.id, { label: v })} className="!text-vid" /></td>
                <td className="td"><Sel value={r.type} options={SIG} onChange={(v) => patch("inputs", r.id, { type: v })} mono /></td>
                <td className="td"><Sel value={r.res} options={RES} onChange={(v) => patch("inputs", r.id, { res: v })} mono /></td>
                <td className="td"><Cell mono value={r.ip} onChange={(v) => patch("inputs", r.id, { ip: v })} /></td>
                <td className="td text-center !align-middle"><Check checked={r.audio} onChange={(b) => patch("inputs", r.id, { audio: b })} color="accent-aud" label="Audio embedded" /></td>
                <td className="td">
                  <div className="flex items-center gap-1.5">
                    <span className={cx("h-2 w-2 shrink-0 rounded-full", r.status === "Locked" ? "bg-pvw" : r.status === "Testing" ? "bg-cg" : "bg-pgm")} />
                    <Sel value={r.status} options={STAT} onChange={(v) => patch("inputs", r.id, { status: v })} />
                  </div>
                </td>
                <td className="td !align-middle"><IconBtn title="Delete input" danger onClick={() => remove("inputs", r.id)}><Trash2 size={15} /></IconBtn></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="mt-1.5 flex gap-2 text-[11px] text-fg-muted">
          {(["Locked", "Testing", "No Signal"] as SignalStatus[]).map((s) => (
            <Badge key={s} tone={tone(s)}>{show.inputs.filter((i) => i.status === s).length} {s}</Badge>
          ))}
        </div>
      </div>

      <div>
        <SectionHead title="Outputs / Aux Routing" accent="bg-aud">
          <button className="btn" onClick={addOutput}><Plus size={14} /> Add output</button>
        </SectionHead>
        <TableWrap>
          <thead><tr>
            <th className="th w-[150px]">Output Port</th><th className="th min-w-[280px]">Destination</th><th className="th w-[120px]">Resolution</th>
            <th className="th w-[120px]">Include CG</th><th className="th w-[44px]" />
          </tr></thead>
          <tbody>
            {show.outputs.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="td"><Sel value={o.port} options={OUT_PORTS} onChange={(v) => patch("outputs", o.id, { port: v })} mono /></td>
                <td className="td"><Cell value={o.dest} list="dest-options" onChange={(v) => patch("outputs", o.id, { dest: v })} placeholder="Destination" /></td>
                <td className="td"><Sel value={o.res} options={RES} onChange={(v) => patch("outputs", o.id, { res: v })} mono /></td>
                <td className="td !align-middle"><label className="flex items-center gap-2 px-1.5 text-xs text-fg-soft"><Check checked={o.cg} onChange={(b) => patch("outputs", o.id, { cg: b })} color="accent-cg" label="Include CG" />{o.cg ? <Badge tone="amber">CG ON</Badge> : <Badge>CLEAN</Badge>}</label></td>
                <td className="td !align-middle"><IconBtn title="Delete output" danger onClick={() => remove("outputs", o.id)}><Trash2 size={15} /></IconBtn></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <datalist id="dest-options">{DESTS.concat(["Stream Encoder", "Venue LED Wall (IMAG)", "Stage DSM (Confidence Monitors)", "HyperDeck ISO", "TD Monitor Wall"]).map((d) => <option key={d} value={d} />)}</datalist>
      </div>

      <div>
        <SectionHead title="Stream Ingest Vault" accent="bg-cg" sub="masked · click copy to clipboard" />
        <div className="card grid gap-3 p-3 md:grid-cols-2">
          <Secret label="Primary RTMP / SRT URL" value={show.vault.primary} onChange={(v) => patchVault({ primary: v })} />
          <Secret label="Backup URL" value={show.vault.backup} onChange={(v) => patchVault({ backup: v })} />
          <Secret label="Stream Key" value={show.vault.key} onChange={(v) => patchVault({ key: v })} />
          <Secret label="Target Bitrate (kbps)" value={show.vault.bitrate} onChange={(v) => patchVault({ bitrate: v })} plain />
        </div>
        <p className="mt-1.5 text-[11px] text-fg-muted">Stored in this browser's localStorage and included in the JSON export — keep backups private. The CSV export omits the stream key.</p>
      </div>
    </section>
  );
}

function Secret({ label, value, onChange, plain }: { label: string; value: string; onChange: (v: string) => void; plain?: boolean }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); }
    catch { const t = document.createElement("textarea"); t.value = value; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div>
      <span className="label mb-1 block">{label}</span>
      <div className="flex items-center gap-1 rounded-md border border-line bg-canvas px-1">
        <input className="cell cell-mono !border-transparent" type={plain || show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
        {!plain && <IconBtn title={show ? "Hide" : "Reveal"} onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</IconBtn>}
        <button className={cx("btn !py-1", copied && "!border-pvw !text-pvw")} onClick={copy}><Copy size={13} />{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}
