"use client";
import React, { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Crosshair, Image as ImageIcon, Grid3x3, Globe2, Plus, Ruler, Search, Trash2, Copy, Upload, LocateFixed, Radio, Anchor, X, Info, Camera as CameraIcon, ChevronDown,
} from "lucide-react";
import { uid, useShow } from "@/lib/store";
import type { MarkerKind, SiteImage, SiteMap, SiteMarker, SiteMode } from "@/lib/types";
import { ENVIRONMENTS, RF_PRESETS, evaluate, fmtDist, fromM, toM, dbmToMw, presetSpec, type LinkResult, type RfSpec, type Unit } from "@/lib/rf";
import { distM, fromView, radiusToView, round2, toView, type LL } from "@/lib/siteGeo";
import { Badge, Check, SectionHead, TableWrap, cx } from "@/components/ui";
import type { CanvasItem, CanvasLink, Tool } from "./SiteCanvas";

const SiteCanvas = dynamic(() => import("./SiteCanvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center rounded-xl bg-raise text-xs text-fg-muted">Loading map…</div>,
});

const KINDS: { kind: MarkerKind; label: string }[] = [
  { kind: "wireless", label: "Wireless transmitter" },
  { kind: "operator", label: "Operator / crew" },
  { kind: "camera", label: "Camera position" },
  { kind: "rx", label: "Receiver / antenna" },
  { kind: "foh", label: "FOH" },
  { kind: "stage", label: "Stage point" },
  { kind: "other", label: "Other" },
];
const kindLabel = (k: MarkerKind) => KINDS.find((x) => x.kind === k)?.label ?? k;
const STATUS_TEXT = { ok: "Solid", marginal: "Marginal", fail: "Out of range", unknown: "No target" } as const;
const STATUS_TONE = { ok: "green", marginal: "amber", fail: "red", unknown: "gray" } as const;

export function SitePlan() {
  const { show, setShow, canEdit } = useShow();
  const sm = show.siteMap;
  const u: Unit = sm.units ?? "m";
  const img = show.siteImage;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [calibPts, setCalibPts] = useState<LL[]>([]);
  const [calibM, setCalibM] = useState("");
  const [keepOnPlan, setKeepOnPlan] = useState(true);
  const [focus, setFocus] = useState<{ ll: LL; zoom?: number; n: number } | null>(null);
  const view = useRef<{ center: LL; zoom: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const setSite = (fn: (s: SiteMap) => SiteMap) => setShow((sh) => ({ ...sh, siteMap: fn(sh.siteMap) }));
  const patchMarker = (id: string, p: Partial<SiteMarker>) => setSite((s) => ({ ...s, markers: s.markers.map((m) => (m.id === id ? { ...m, ...p } : m)) }));
  const patchRf = (id: string, p: Partial<RfSpec>) => setSite((s) => ({ ...s, markers: s.markers.map((m) => (m.id === id && m.rf ? { ...m, rf: { ...m.rf, ...p } } : m)) }));

  const receivers = sm.markers.filter((m) => m.kind === "foh" || m.kind === "rx");
  const defaultTarget = sm.markers.find((m) => m.kind === "foh") ?? receivers[0] ?? null;
  const targetOf = (m: SiteMarker) => sm.markers.find((x) => x.id === m.rf?.targetId) ?? defaultTarget;

  const results = useMemo(() => {
    const r = new Map<string, LinkResult & { target: SiteMarker | null }>();
    for (const m of sm.markers) {
      if (!m.rf) continue;
      const t = sm.markers.find((x) => x.id === m.rf!.targetId) ?? defaultTarget;
      r.set(m.id, { ...evaluate(m.rf, t && t.id !== m.id ? distM(m.s, t.s) : null, sm.n), target: t && t.id !== m.id ? t : null });
    }
    return r;
  }, [sm.markers, sm.n, defaultTarget]);

  const items: CanvasItem[] = sm.markers.map((m) => ({ id: m.id, kind: m.kind, label: m.label, ll: toView(m.s, sm, img), status: results.get(m.id)?.status ?? null }));
  const links: CanvasLink[] = sm.markers.filter((m) => m.rf).map((m) => {
    const r = results.get(m.id)!;
    return { id: m.id, from: toView(m.s, sm, img), to: r.target ? toView(r.target.s, sm, img) : null, status: r.status, solidR: radiusToView(r.solidRangeM, sm, img), maxR: radiusToView(r.maxRangeM, sm, img) };
  });

  const selected = sm.markers.find((m) => m.id === selectedId) ?? null;
  const calibrated = sm.mode !== "image" || sm.image.mpp != null;

  /* ---------- actions ---------- */
  const addMarker = (kind: MarkerKind, ll: LL) => {
    const count = sm.markers.filter((m) => m.kind === kind).length + 1;
    const label = { wireless: `Wireless ${count}`, operator: `Operator ${count}`, camera: `CAM ${count}`, rx: `RX ${count}`, foh: "FOH", stage: "Stage point", other: `Marker ${count}` }[kind];
    const m: SiteMarker = { id: uid(), kind, label, operator: "", notes: "", s: roundS(fromView(ll, sm, img)), rf: kind === "wireless" ? presetSpec("uhf-mic", defaultTarget?.id ?? null) : null };
    setSite((s) => ({ ...s, markers: [...s.markers, m] }));
    setSelectedId(m.id);
    setTool(null);
  };

  /** Change image alignment; optionally keep every marker on the same spot of the picture. */
  const realignImage = (next: SiteMap["image"], keep: boolean) =>
    setSite((s) => {
      const ns = { ...s, image: next };
      if (!keep) return ns;
      return { ...ns, markers: s.markers.map((m) => ({ ...m, s: roundS(fromView(toView(m.s, { ...s, mode: "image" }, img), { ...ns, mode: "image" }, img)) })) };
    });

  const onToolClick = (ll: LL) => {
    if (!tool) return;
    if (tool.type === "place") return addMarker(tool.kind, ll);
    if (tool.type === "origin") { realignImage({ ...sm.image, originX: ll[1], originY: ll[0] }, keepOnPlan); setTool(null); return; }
    if (tool.type === "calib") setCalibPts((p) => (p.length >= 2 ? [ll] : [...p, ll]));
  };

  const applyCalib = () => {
    const meters = parseFloat(calibM);
    if (calibPts.length !== 2 || !(meters > 0)) return;
    const px = Math.hypot(calibPts[0][0] - calibPts[1][0], calibPts[0][1] - calibPts[1][1]);
    if (px < 1) return;
    realignImage({ ...sm.image, mpp: meters / px }, keepOnPlan);
    setCalibPts([]); setCalibM(""); setTool(null);
  };

  const setMode = (mode: SiteMode) => { setTool(null); setCalibPts([]); setSite((s) => ({ ...s, mode })); };

  const importCameras = () => {
    const have = new Set(sm.markers.filter((m) => m.kind === "camera").map((m) => m.label.toLowerCase()));
    const fresh: SiteMarker[] = show.cameras
      .filter((c) => !have.has(c.label.toLowerCase()) && ![...have].some((h) => h.startsWith(c.label.toLowerCase())))
      .map((c) => ({ id: uid(), kind: "camera", label: c.label, operator: c.operator, notes: [c.body, c.lens, c.mount].filter(Boolean).join(" · "), s: { x: round2((c.x - 500) * 0.05), y: round2((c.y - 230) * 0.05) }, rf: /ndi|wireless|wifi/i.test(c.cable) ? presetSpec("wifi-ndi", defaultTarget?.id ?? null) : null }));
    if (fresh.length) setSite((s) => ({ ...s, markers: [...s.markers, ...fresh] }));
    else window.alert("All cameras from the Camera Plot are already on the map.");
  };

  return (
    <div className="space-y-4">
      <SectionHead title="Site & RF Plan" accent="bg-med" sub="Plot crew, cameras and wireless gear — and check every transmitter can reach FOH">
        <Segmented value={sm.mode} onChange={setMode} options={[
          { v: "image", label: "Floor plan", icon: <ImageIcon size={14} /> },
          { v: "grid", label: "Stage grid", icon: <Grid3x3 size={14} /> },
          { v: "geo", label: "Map", icon: <Globe2 size={14} /> },
        ]} />
      </SectionHead>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="relative">
          <button className="btn-primary !py-1.5" disabled={!canEdit} onClick={() => setAddOpen((o) => !o)}><Plus size={14} /> Add marker <ChevronDown size={13} /></button>
          {addOpen && (
            <div className="absolute left-0 top-full z-[600] mt-2 w-56 rounded-xl border border-line bg-surface p-1 shadow-xl" onMouseLeave={() => setAddOpen(false)}>
              {KINDS.map((k) => (
                <button key={k.kind} onClick={() => { setAddOpen(false); setCalibPts([]); setTool({ type: "place", kind: k.kind }); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-fg hover:bg-raise">
                  <span className={cx("h-2.5 w-2.5 rounded-full", dotClass(k.kind))} />{k.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn" disabled={!canEdit} onClick={importCameras} title="Add every camera from the Camera Plot tab"><CameraIcon size={14} /> Import cameras</button>

        <span className="mx-1 h-6 w-px bg-line" />

        {sm.mode === "image" && (
          <>
            <UploadPlan disabled={!canEdit} onImage={(si) => {
              setShow((sh) => ({ ...sh, siteImage: si, siteMap: { ...sh.siteMap, image: { originX: si.w / 2, originY: si.h * 0.62, mpp: null, rotDeg: 0 } } }));
              setKeepOnPlan(false);
            }} />
            <button className={cx("btn", tool?.type === "calib" && "!border-brand !bg-brand-soft !text-brand")} disabled={!canEdit} onClick={() => { setCalibPts([]); setTool(tool?.type === "calib" ? null : { type: "calib" }); }}>
              <Ruler size={14} /> Set scale
            </button>
            <button className={cx("btn", tool?.type === "origin" && "!border-brand !bg-brand-soft !text-brand")} disabled={!canEdit} onClick={() => setTool(tool?.type === "origin" ? null : { type: "origin" })}>
              <Crosshair size={14} /> Set downstage centre
            </button>
            <label className="flex items-center gap-1.5 text-xs text-fg-muted">Plan rotation
              <input type="number" className="cell cell-mono !w-16 border-line" value={sm.image.rotDeg} disabled={!canEdit}
                onChange={(e) => realignImage({ ...sm.image, rotDeg: Number(e.target.value) || 0 }, false)} />°
            </label>
            <span className="font-mono text-[11px] text-fg-muted">{sm.image.mpp ? `1 px = ${(sm.image.mpp * 100).toFixed(1)} cm` : "scale not set"}</span>
          </>
        )}
        {sm.mode === "grid" && <span className="text-xs text-fg-muted">Metres from downstage centre · X → audience-right, Y → into the house. Type exact positions in the side panel.</span>}
        {sm.mode === "geo" && (
          <GeoTools sm={sm} canEdit={canEdit}
            onFocus={(ll, zoom) => setFocus({ ll, zoom, n: Date.now() })}
            onLayer={(layer) => setSite((s) => ({ ...s, geo: { ...s.geo, layer } }))}
            onBearing={(bearingDeg) => setSite((s) => ({ ...s, geo: { ...s.geo, bearingDeg } }))}
            onAnchorHere={() => { const v = view.current; if (v) setSite((s) => ({ ...s, geo: { ...s.geo, lat: v.center[0], lng: v.center[1], zoom: Math.round(v.zoom) } })); }} />
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <select className="cell !w-auto border-line text-xs" value={sm.envKey} disabled={!canEdit}
            onChange={(e) => { const env = ENVIRONMENTS.find((x) => x.key === e.target.value)!; setSite((s) => ({ ...s, envKey: env.key, n: env.n })); }} title="Propagation environment">
            {ENVIRONMENTS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <div className="inline-flex rounded-full border border-line bg-surface p-0.5" title="Distance units">
            {(["m", "ft"] as const).map((x) => (
              <button key={x} onClick={() => setSite((s) => ({ ...s, units: x }))} className={cx("rounded-full px-2.5 py-1 font-mono text-xs font-medium", u === x ? "bg-inverse text-on-inverse" : "text-fg-muted hover:text-fg")}>{x}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-fg-soft"><Check checked={sm.showRings} onChange={(b) => setSite((s) => ({ ...s, showRings: b }))} color="accent-med" label="Show all range rings" />All rings</label>
        </span>
      </div>

      {/* Tool hints */}
      {tool && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-[13px] text-fg">
          <Info size={15} className="text-brand" />
          {tool.type === "place" && <>Click on the map to place a <b>{kindLabel(tool.kind).toLowerCase()}</b>.</>}
          {tool.type === "origin" && <>Click the <b>downstage centre</b> on the plan — it becomes position (0, 0).</>}
          {tool.type === "calib" && (calibPts.length < 2
            ? <>Click two points on the plan whose real distance you know (e.g. the stage width). {calibPts.length}/2</>
            : <span className="flex flex-wrap items-center gap-2">Real distance between the points:
                <input autoFocus type="number" min="0" step="0.1" className="cell cell-mono !w-24 border-line bg-surface" placeholder="metres" value={calibM} onChange={(e) => setCalibM(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyCalib()} /> m
                <button className="btn-primary !py-1.5" onClick={applyCalib} disabled={!(parseFloat(calibM) > 0)}>Apply scale</button>
              </span>)}
          {(tool.type === "calib" || tool.type === "origin") && (
            <label className="flex items-center gap-1.5 text-xs text-fg-soft"><Check checked={keepOnPlan} onChange={setKeepOnPlan} color="accent-med" label="Keep markers on the picture" />Keep markers where they are on the picture</label>
          )}
          <button className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg" onClick={() => { setTool(null); setCalibPts([]); }}><X size={13} /> Cancel</button>
        </div>
      )}
      {sm.mode === "image" && !calibrated && !tool && (
        <div className="flex items-center gap-2 rounded-xl border border-cg/30 bg-cg/10 px-3.5 py-2.5 text-[13px] text-fg"><Ruler size={15} className="text-cg" /> The plan isn't scaled yet, so distances and RF ranges are guesses. Use <b>Set scale</b> and click two points of known distance.</div>
      )}

      {/* Map + side panel */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card relative isolate z-0 h-[min(72vh,760px)] min-h-[480px] overflow-hidden p-2">
          <SiteCanvas sm={sm} img={img} items={items} links={links} canEdit={canEdit} selectedId={selectedId} tool={tool} calibPts={calibPts} focus={focus}
            originLL={toView({ x: 0, y: 0 }, sm, img)}
            onSelect={setSelectedId}
            onMove={(id, ll) => patchMarker(id, { s: roundS(fromView(ll, sm, img)) })}
            onToolClick={onToolClick}
            onView={(center, zoom) => (view.current = { center, zoom })} />
        </div>

        <aside className="card flex max-h-[min(72vh,760px)] min-h-[480px] flex-col overflow-hidden">
          {selected ? (
            <Inspector u={u} m={selected} sm={sm} result={results.get(selected.id)} receivers={receivers} defaultTarget={defaultTarget}
              onPatch={(p) => patchMarker(selected.id, p)} onRf={(p) => patchRf(selected.id, p)} onClose={() => setSelectedId(null)}
              onDelete={() => { setSite((s) => ({ ...s, markers: s.markers.filter((m) => m.id !== selected.id) })); setSelectedId(null); }}
              onDuplicate={() => { const c = { ...selected, id: uid(), label: `${selected.label} copy`, s: { x: selected.s.x + 1, y: selected.s.y + 1 } }; setSite((s) => ({ ...s, markers: [...s.markers, c] })); setSelectedId(c.id); }} />
          ) : (
            <MarkerList u={u} markers={sm.markers} results={results} onSelect={setSelectedId} />
          )}
        </aside>
      </div>

      <RfTable u={u} markers={sm.markers} results={results} n={sm.n} onSelect={setSelectedId} />
    </div>
  );
}

const roundS = (s: { x: number; y: number }) => ({ x: round2(s.x), y: round2(s.y) });
const dotClass = (k: MarkerKind) => ({ foh: "bg-aud", rx: "bg-aud", wireless: "bg-med", camera: "bg-vid", operator: "bg-fg-soft", stage: "bg-cg", other: "bg-fg-muted" }[k]);

/* ---------------- Inspector ---------------- */
function Inspector({ u, m, sm, result, receivers, defaultTarget, onPatch, onRf, onClose, onDelete, onDuplicate }: {
  u: Unit; m: SiteMarker; sm: SiteMap; result?: LinkResult & { target: SiteMarker | null }; receivers: SiteMarker[]; defaultTarget: SiteMarker | null;
  onPatch: (p: Partial<SiteMarker>) => void; onRf: (p: Partial<RfSpec>) => void; onClose: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const rf = m.rf;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className={cx("h-2.5 w-2.5 rounded-full", dotClass(m.kind))} />
        <span className="flex-1 truncate text-sm font-semibold text-fg">{m.label || "Untitled"}</span>
        <button title="Duplicate" onClick={onDuplicate} className="rounded-lg p-1.5 text-fg-muted hover:bg-raise hover:text-fg"><Copy size={15} /></button>
        <button title="Delete" onClick={onDelete} className="rounded-lg p-1.5 text-fg-muted hover:bg-raise hover:text-pgm"><Trash2 size={15} /></button>
        <button title="Close" onClick={onClose} className="rounded-lg p-1.5 text-fg-muted hover:bg-raise hover:text-fg"><X size={15} /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <F label="Label" span><input className="cell border-line" value={m.label} onChange={(e) => onPatch({ label: e.target.value })} /></F>
          <F label="Type">
            <select className="cell border-line" value={m.kind} onChange={(e) => {
              const kind = e.target.value as MarkerKind;
              onPatch({ kind, rf: kind === "wireless" && !m.rf ? presetSpec("uhf-mic", defaultTarget?.id ?? null) : m.rf });
            }}>{KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select>
          </F>
          <F label="Operator"><input className="cell border-line" value={m.operator} onChange={(e) => onPatch({ operator: e.target.value })} placeholder="Name" /></F>
          <F label={`X (${u})`}><input type="number" step="0.1" className="cell cell-mono border-line" value={round2(fromM(m.s.x, u))} onChange={(e) => onPatch({ s: { ...m.s, x: round2(toM(Number(e.target.value) || 0, u)) } })} /></F>
          <F label={`Y (${u})`}><input type="number" step="0.1" className="cell cell-mono border-line" value={round2(fromM(m.s.y, u))} onChange={(e) => onPatch({ s: { ...m.s, y: round2(toM(Number(e.target.value) || 0, u)) } })} /></F>
          <F label="Notes" span><input className="cell border-line" value={m.notes} onChange={(e) => onPatch({ notes: e.target.value })} /></F>
        </div>
        <p className="-mt-2 text-[11px] text-fg-faint">Position in {u === "ft" ? "feet" : "metres"} from downstage centre{sm.mode === "geo" ? " — drag on the map or type it here" : ""}.</p>

        <div className="rounded-xl border border-line">
          <label className="flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-fg">
            <Check checked={!!rf} onChange={(b) => onPatch({ rf: b ? presetSpec(m.kind === "camera" ? "video-5g" : m.kind === "operator" ? "dect" : "uhf-mic", defaultTarget?.id ?? null) : null })} color="accent-med" label="Wireless link" />
            <Radio size={14} className="text-med" /> Wireless link to receiver
          </label>
          {rf && (
            <div className="space-y-3 border-t border-line p-3">
              <F label="Device preset">
                <select className="cell border-line" value={rf.preset} onChange={(e) => onRf({ ...presetSpec(e.target.value, rf.targetId) })}>
                  <optgroup label="By RF specs (dBm)">{RF_PRESETS.filter((p) => !p.group).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</optgroup>
                  <optgroup label="By rated range (ft / m)">{RF_PRESETS.filter((p) => p.group === "rated").map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</optgroup>
                </select>
              </F>
              <F label="Receiver (target)">
                <select className="cell border-line" value={rf.targetId ?? ""} onChange={(e) => onRf({ targetId: e.target.value || null })}>
                  <option value="">{defaultTarget ? `Default — ${defaultTarget.label}` : "— add a FOH or RX marker —"}</option>
                  {receivers.filter((r) => r.id !== m.id).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </F>
              <div className="inline-flex w-full rounded-lg border border-line bg-raise p-0.5">
                {([["specs", "RF specs (dBm)"], ["rated", "Rated range"]] as const).map(([k, l]) => {
                  const on = (k === "rated") === !!rf.rated;
                  return (
                    <button key={k} type="button" onClick={() => onRf(k === "rated" ? { rated: rf.rated ?? { value: Math.round(fromM(result?.solidRangeM ?? 100, u)), unit: u }, preset: "rated-custom" } : { rated: null, preset: "custom" })}
                      className={cx("flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition", on ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}>{l}</button>
                  );
                })}
              </div>
              {rf.rated ? (
                <>
                  <F label="Manufacturer's rated range (line of sight)">
                    <div className="flex gap-2">
                      <input type="number" min={0} step="any" className="cell cell-mono flex-1 border-line" value={rf.rated.value}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onRf({ rated: { ...rf.rated!, value: v }, preset: rf.preset === "rated-custom" ? rf.preset : "rated-custom" }); }} />
                      <select className="cell !w-20 border-line font-mono" value={rf.rated.unit} onChange={(e) => {
                        const unit = e.target.value as Unit; const meters = toM(rf.rated!.value, rf.rated!.unit);
                        onRf({ rated: { value: Math.round(fromM(meters, unit) * 10) / 10, unit } });
                      }}>
                        <option value="ft">ft</option><option value="m">m</option>
                      </select>
                    </div>
                  </F>
                  <p className="-mt-1 text-[11px] leading-snug text-fg-muted">
                    = {fmtDist(toM(rf.rated.value, rf.rated.unit), rf.rated.unit === "ft" ? "m" : "ft")}. Treated as the reliable range in open air, then shortened for the environment you pick ({ENVIRONMENTS.find((e) => e.n === sm.n)?.label.toLowerCase() ?? `n = ${sm.n}`}).
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Num label="Extra loss (dB)" v={rf.extraLossDb} on={(v) => onRf({ extraLossDb: v })} />
                    <Num label="Fade margin (dB)" v={rf.fadeMarginDb} on={(v) => onRf({ fadeMarginDb: v })} />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Num label="Frequency (MHz)" v={rf.freqMHz} on={(v) => onRf({ freqMHz: v, preset: "custom" })} />
                  <Num label="TX power (dBm)" v={rf.txDbm} on={(v) => onRf({ txDbm: v, preset: "custom" })} hint={`${fmtMw(dbmToMw(rf.txDbm))}`} />
                  <Num label="TX antenna (dBi)" v={rf.txGainDbi} on={(v) => onRf({ txGainDbi: v, preset: "custom" })} />
                  <Num label="RX antenna (dBi)" v={rf.rxGainDbi} on={(v) => onRf({ rxGainDbi: v, preset: "custom" })} />
                  <Num label="RX sensitivity (dBm)" v={rf.sensDbm} on={(v) => onRf({ sensDbm: v, preset: "custom" })} />
                  <Num label="Body / crowd loss (dB)" v={rf.extraLossDb} on={(v) => onRf({ extraLossDb: v, preset: "custom" })} />
                  <Num label="Fade margin (dB)" v={rf.fadeMarginDb} on={(v) => onRf({ fadeMarginDb: v, preset: "custom" })} />
                </div>
              )}

              {result && (
                <div className={cx("rounded-xl p-3", { ok: "bg-pvw/10", marginal: "bg-cg/10", fail: "bg-pgm/10", unknown: "bg-raise" }[result.status])}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-fg">to {result.target?.label ?? "—"}</span>
                    <Badge tone={STATUS_TONE[result.status]}>{STATUS_TEXT[result.status]}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                    <Stat k="Distance" v={fmtDist(result.distM, u)} />
                    <Stat k={rf.rated ? "Rated (open air)" : "Est. signal"} v={rf.rated ? fmtDist(toM(rf.rated.value, rf.rated.unit), u) : result.rxDbm == null ? "—" : `${result.rxDbm.toFixed(0)} dBm`} />
                    <Stat k="Margin" v={result.marginDb == null ? "—" : `${result.marginDb >= 0 ? "+" : ""}${result.marginDb.toFixed(0)} dB`} />
                    <Stat k="Needs" v={`≥ ${rf.fadeMarginDb} dB`} />
                    <Stat k="Solid range" v={fmtDist(result.solidRangeM, u)} ring="solid" />
                    <Stat k="Max range" v={fmtDist(result.maxRangeM, u)} ring="max" />
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MarkerList({ u, markers, results, onSelect }: { u: Unit; markers: SiteMarker[]; results: Map<string, LinkResult>; onSelect: (id: string) => void }) {
  const groups = KINDS.map((k) => ({ ...k, list: markers.filter((m) => m.kind === k.kind) })).filter((g) => g.list.length);
  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <div className="text-sm font-semibold text-fg">Markers <span className="font-normal text-fg-muted">· {markers.length}</span></div>
        <div className="text-xs text-fg-muted">Click a marker on the map or in this list to edit it.</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {groups.map((g) => (
          <div key={g.kind} className="mb-2">
            <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-fg-muted">{g.label}</div>
            {g.list.map((m) => {
              const r = results.get(m.id);
              return (
                <button key={m.id} onClick={() => onSelect(m.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-raise">
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", dotClass(m.kind))} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">{m.label}</span>
                    {m.operator && <span className="block truncate text-[11px] text-fg-muted">{m.operator}</span>}
                  </span>
                  {r && <Badge tone={STATUS_TONE[r.status]}>{r.distM == null ? "—" : fmtDist(r.distM, u)}</Badge>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function RfTable({ u, markers, results, n, onSelect }: { u: Unit; markers: SiteMarker[]; results: Map<string, LinkResult & { target: SiteMarker | null }>; n: number; onSelect: (id: string) => void }) {
  const rows = markers.filter((m) => m.rf).map((m) => ({ m, r: results.get(m.id)! })).sort((a, b) => (a.r.marginDb ?? 999) - (b.r.marginDb ?? 999));
  const counts = { ok: 0, marginal: 0, fail: 0, unknown: 0 };
  rows.forEach(({ r }) => counts[r.status]++);
  return (
    <section>
      <SectionHead title="Wireless reach check" accent="bg-med" sub={`path-loss exponent n = ${n} · worst links first`}>
        <Badge tone="green">{counts.ok} solid</Badge><Badge tone="amber">{counts.marginal} marginal</Badge><Badge tone="red">{counts.fail} out of range</Badge>
      </SectionHead>
      <TableWrap>
        <thead><tr>
          <th className="th">Transmitter</th><th className="th">Operator</th><th className="th">Device</th><th className="th">Receiver</th>
          <th className="th text-right">Distance</th><th className="th text-right">Est. signal</th><th className="th text-right">Margin</th><th className="th text-right">Solid range</th><th className="th">Status</th>
        </tr></thead>
        <tbody>
          {rows.map(({ m, r }) => (
            <tr key={m.id} onClick={() => onSelect(m.id)} className="cursor-pointer border-t border-line hover:bg-raise/60">
              <td className="td px-3 font-medium text-fg">{m.label}</td>
              <td className="td px-3 text-fg-soft">{m.operator || "—"}</td>
              <td className="td px-3 text-fg-soft">{RF_PRESETS.find((p) => p.key === m.rf!.preset)?.label.split(" — ")[0] ?? "Custom"} <span className="font-mono text-[11px] text-fg-muted">{m.rf!.rated ? `rated ${m.rf!.rated.value.toLocaleString()} ${m.rf!.rated.unit}` : `${m.rf!.freqMHz} MHz`}</span></td>
              <td className="td px-3 text-fg-soft">{r.target?.label ?? "—"}</td>
              <td className="td px-3 text-right font-mono text-[12.5px]">{fmtDist(r.distM, u)}</td>
              <td className="td px-3 text-right font-mono text-[12.5px]">{r.rxDbm == null || m.rf!.rated ? "—" : `${r.rxDbm.toFixed(0)} dBm`}</td>
              <td className={cx("td px-3 text-right font-mono text-[12.5px] font-semibold", { ok: "text-pvw", marginal: "text-cg", fail: "text-pgm", unknown: "text-fg-muted" }[r.status])}>{r.marginDb == null ? "—" : `${r.marginDb >= 0 ? "+" : ""}${r.marginDb.toFixed(0)} dB`}</td>
              <td className="td px-3 text-right font-mono text-[12.5px] text-fg-soft">{fmtDist(r.solidRangeM, u)}</td>
              <td className="td px-3"><Badge tone={STATUS_TONE[r.status]}>{STATUS_TEXT[r.status]}</Badge></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9} className="p-6 text-center text-sm text-fg-muted">No wireless links yet. Add a wireless transmitter, or turn on “Wireless link” for any marker.</td></tr>}
        </tbody>
      </TableWrap>
      <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">
        Estimate from a log-distance link budget (free-space loss at 1 m + 10·n·log₁₀ d). <b>Solid</b> = signal clears sensitivity by the fade margin; <b>marginal</b> = above sensitivity but inside the margin (dropouts likely when bodies, crowds or LED walls get in the way); <b>out of range</b> = below sensitivity. Rings on the map: solid line = solid range, dashed = absolute max. Walls, metal structures and local RF noise aren't modelled — add them as body/crowd loss and always walk-test before doors.
      </p>
    </section>
  );
}

/* ---------------- small parts ---------------- */
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", value === o.v ? "bg-inverse text-on-inverse" : "text-fg-soft hover:text-fg")}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}
function F({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return <label className={cx("block", span && "col-span-2")}><span className="label mb-1 block">{label}</span>{children}</label>;
}
function Num({ label, v, on, hint }: { label: string; v: number; on: (v: number) => void; hint?: string }) {
  return (
    <F label={label}>
      <div className="relative">
        <input type="number" step="any" className="cell cell-mono border-line" value={v} onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) on(n); }} />
        {hint && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-fg-faint">{hint}</span>}
      </div>
    </F>
  );
}
function Stat({ k, v, ring }: { k: string; v: string; ring?: "solid" | "max" }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-fg-muted">{ring && <span className={cx("inline-block h-0 w-4 border-t-2", ring === "solid" ? "border-pvw" : "border-dashed border-cg")} />}{k}</dt>
      <dd className="font-mono font-semibold text-fg">{v}</dd>
    </div>
  );
}
const fmtMw = (mw: number) => (mw >= 1000 ? `${(mw / 1000).toFixed(1)} W` : mw >= 10 ? `${Math.round(mw)} mW` : `${mw.toFixed(1)} mW`);

/** Image upload → downscale & compress so it syncs comfortably with the crew. */
function UploadPlan({ onImage, disabled }: { onImage: (s: SiteImage) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(f);
      const im = new window.Image();
      await new Promise<void>((res, rej) => { im.onload = () => res(); im.onerror = () => rej(new Error("Can't read that image")); im.src = url; });
      const MAX = 2000;
      const k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = 0.85, src = c.toDataURL("image/jpeg", q);
      while (src.length > 1_400_000 && q > 0.4) { q -= 0.1; src = c.toDataURL("image/jpeg", q); }
      onImage({ src, name: f.name, w, h });
    } catch (e) { window.alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn" disabled={disabled || busy} onClick={() => ref.current?.click()}><Upload size={14} /> {busy ? "Processing…" : "Upload plan"}</button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );
}

function GeoTools({ sm, canEdit, onFocus, onLayer, onBearing, onAnchorHere }: {
  sm: SiteMap; canEdit: boolean; onFocus: (ll: LL, zoom?: number) => void; onLayer: (l: "street" | "satellite") => void; onBearing: (b: number) => void; onAnchorHere: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ name: string; ll: LL }[]>([]);
  const [busy, setBusy] = useState(false);
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    const m = t.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) { onFocus([parseFloat(m[1]), parseFloat(m[2])], 19); setHits([]); return; }
    if (!t) return;
    setBusy(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(t)}`, { headers: { Accept: "application/json" } });
      const j: { display_name: string; lat: string; lon: string }[] = await r.json();
      setHits(j.map((x) => ({ name: x.display_name, ll: [parseFloat(x.lat), parseFloat(x.lon)] as LL })));
    } catch { setHits([]); } finally { setBusy(false); }
  };
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((sm.geo.bearingDeg % 360) + 360) % 360) / 45) % 8];
  return (
    <>
      <form onSubmit={search} className="relative">
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1">
          <Search size={13} className="text-fg-muted" />
          <input className="w-56 bg-transparent py-0.5 text-xs text-fg outline-none placeholder:text-fg-faint" placeholder="Search venue or paste lat, lng" value={q} onChange={(e) => setQ(e.target.value)} />
          {busy && <span className="text-[10px] text-fg-muted">…</span>}
        </div>
        {hits.length > 0 && (
          <div className="absolute left-0 top-full z-[600] mt-2 w-96 rounded-xl border border-line bg-surface p-1 shadow-xl">
            {hits.map((h, i) => (
              <button type="button" key={i} onClick={() => { onFocus(h.ll, 18); setHits([]); }} className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-xs text-fg hover:bg-raise">{h.name}</button>
            ))}
            <div className="px-2.5 pb-1 pt-1 text-[10px] text-fg-faint">Search © OpenStreetMap Nominatim</div>
          </div>
        )}
      </form>
      <button className="btn" title="Go to my location" onClick={() => navigator.geolocation?.getCurrentPosition((p) => onFocus([p.coords.latitude, p.coords.longitude], 19))}><LocateFixed size={14} /></button>
      <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
        {(["street", "satellite"] as const).map((l) => (
          <button key={l} onClick={() => onLayer(l)} className={cx("rounded-full px-2.5 py-1 text-xs font-medium capitalize", sm.geo.layer === l ? "bg-raise text-fg" : "text-fg-muted hover:text-fg")}>{l}</button>
        ))}
      </div>
      <button className="btn" disabled={!canEdit} onClick={onAnchorHere} title="Move the whole layout so downstage centre sits at the middle of the map"><Anchor size={14} /> Put stage at map centre</button>
      <label className="flex items-center gap-1.5 text-xs text-fg-muted" title="Compass direction from the stage toward the audience / FOH">Stage faces
        <input type="range" min={0} max={359} value={sm.geo.bearingDeg} disabled={!canEdit} onChange={(e) => onBearing(Number(e.target.value))} className="w-24 accent-[rgb(var(--brand))]" />
        <span className="w-14 font-mono text-fg">{Math.round(sm.geo.bearingDeg)}° {compass}</span>
      </label>
    </>
  );
}
