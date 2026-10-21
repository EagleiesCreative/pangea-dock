"use client";
import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, CircleMarker, ImageOverlay, MapContainer, Marker, Polyline, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { MarkerKind, SiteImage, SiteMap } from "@/lib/types";
import type { LinkStatus } from "@/lib/rf";
import type { LL } from "@/lib/siteGeo";

export type Tool = null | { type: "place"; kind: MarkerKind } | { type: "calib" } | { type: "origin" };
export interface CanvasItem { id: string; kind: MarkerKind; label: string; ll: LL; status: LinkStatus | null }
export interface CanvasLink { id: string; from: LL; to: LL | null; status: LinkStatus; solidR: number; maxR: number }

interface Props {
  sm: SiteMap;
  img: SiteImage;
  items: CanvasItem[];
  links: CanvasLink[];
  canEdit: boolean;
  selectedId: string | null;
  tool: Tool;
  calibPts: LL[];
  focus: { ll: LL; zoom?: number; n: number } | null;
  originLL: LL;
  onSelect: (id: string | null) => void;
  onMove: (id: string, ll: LL) => void;
  onToolClick: (ll: LL) => void;
  onView: (center: LL, zoom: number) => void;
}

const ABBR: Record<MarkerKind, string> = { foh: "FOH", rx: "RX", wireless: "TX", camera: "CAM", operator: "OP", stage: "DS", other: "•" };

function icon(kind: MarkerKind, label: string, selected: boolean, status: LinkStatus | null) {
  const short = kind === "camera" ? (label.match(/\d+/)?.[0] ? `C${label.match(/\d+/)![0]}` : "CAM") : ABBR[kind];
  const esc = label.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div class="pd-pin pd-k-${kind}${selected ? " pd-sel" : ""}${status ? ` pd-st-${status}` : ""}"><span>${short}</span></div><div class="pd-pin-label">${esc}</div>`,
  });
}

function Behaviour({ sm, img, items, tool, focus, onSelect, onToolClick, onView }: Pick<Props, "sm" | "img" | "items" | "tool" | "focus" | "onSelect" | "onToolClick" | "onView">) {
  const map = useMap();
  const did = useRef(false);
  useEffect(() => {
    if (did.current) return;
    did.current = true;
    if (sm.mode === "image") map.fitBounds([[0, 0], [img.h || 600, img.w || 1000]], { padding: [16, 16] });
    else if (sm.mode === "grid") {
      const pts = items.map((i) => i.ll);
      map.fitBounds(pts.length ? L.latLngBounds(pts).pad(0.15) : L.latLngBounds([[-30, -25], [10, 25]]), { maxZoom: 4 });
    } else if (items.length > 1) map.fitBounds(L.latLngBounds(items.map((i) => i.ll)).pad(0.25), { maxZoom: 20 });
    else map.setView([sm.geo.lat, sm.geo.lng], sm.geo.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (focus) map.flyTo(focus.ll, focus.zoom ?? map.getZoom(), { duration: 0.6 }); }, [focus, map]);
  useEffect(() => { map.getContainer().style.cursor = tool ? "crosshair" : ""; }, [tool, map]);
  useMapEvents({
    click: (e) => (tool ? onToolClick([e.latlng.lat, e.latlng.lng]) : onSelect(null)),
    moveend: () => { const c = map.getCenter(); onView([c.lat, c.lng], map.getZoom()); },
  });
  return null;
}

function GridLines() {
  const lines = useMemo(() => {
    const out: { pos: LL[]; major: boolean }[] = [];
    for (let v = -100; v <= 100; v += 5) {
      out.push({ pos: [[-100, v], [100, v]], major: v === 0 });
      out.push({ pos: [[v, -100], [v, 100]], major: v === 0 });
    }
    return out;
  }, []);
  return (
    <>
      {lines.map((l, i) => <Polyline key={i} positions={l.pos} className={l.major ? "pd-grid-major" : "pd-grid"} interactive={false} />)}
      <Polyline positions={[[0, -100], [0, 100]]} className={"pd-grid-ds"} interactive={false} />
      <CircleMarker center={[0, -24]} radius={0} interactive={false} className="pd-grid-ds">
        <Tooltip permanent direction="top" offset={[0, -2]} className="pd-tip">Downstage edge · y = 0</Tooltip>
      </CircleMarker>
    </>
  );
}

export default function SiteCanvas(p: Props) {
  const { sm, img } = p;
  const flat = sm.mode !== "geo";
  const crs = flat ? L.CRS.Simple : L.CRS.EPSG3857;
  const linkClass = (s: LinkStatus) => `pd-link pd-${s}`;

  return (
    <MapContainer
      key={`${sm.mode}-${sm.mode === "image" ? `${img.w}x${img.h}-${img.src?.length ?? 0}` : ""}`}
      crs={crs}
      center={flat ? [0, 0] : [sm.geo.lat, sm.geo.lng]}
      zoom={flat ? 0 : sm.geo.zoom}
      minZoom={flat ? -4 : 3}
      maxZoom={flat ? 6 : 22}
      zoomSnap={0.25}
      attributionControl={!flat}
      className="h-full w-full rounded-xl bg-raise"
    >
      <Behaviour sm={sm} img={img} items={p.items} tool={p.tool} focus={p.focus} onSelect={p.onSelect} onToolClick={p.onToolClick} onView={p.onView} />

      {sm.mode === "image" && img.src && <ImageOverlay url={img.src} bounds={[[0, 0], [img.h, img.w]]} />}
      {sm.mode === "grid" && <GridLines />}
      {sm.mode === "geo" && (sm.geo.layer === "satellite"
        ? <TileLayer key="sat" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={22} attribution="Imagery © Esri, Maxar, Earthstar Geographics" />
        : <TileLayer key="osm" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={22} attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />)}
      {sm.mode !== "image" && <ScaleControl position="bottomleft" imperial={false} />}

      {/* stage origin */}
      <CircleMarker center={p.originLL} radius={4} className={"pd-origin"} interactive={false} />

      {/* range rings + links */}
      {p.links.map((l) => {
        const show = sm.showRings || l.id === p.selectedId;
        return (
          <React.Fragment key={l.id}>
            {show && <Circle key={`mx-${l.id}`} center={l.from} radius={l.maxR} className={"pd-ring-max"} interactive={false} />}
            {show && <Circle key={`so-${l.id}-${l.id === p.selectedId}`} center={l.from} radius={l.solidR} className={`pd-ring-solid${l.id === p.selectedId ? " pd-ring-sel" : ""}`} interactive={false} />}
            {l.to && <Polyline key={`ln-${l.id}-${l.status}-${l.id === p.selectedId}`} positions={[l.from, l.to]} className={linkClass(l.status) + (l.id === p.selectedId ? " pd-link-sel" : "")} interactive={false} />}
          </React.Fragment>
        );
      })}

      {/* calibration points */}
      {p.calibPts.map((c, i) => <CircleMarker key={i} center={c} radius={6} className={"pd-calib"} interactive={false} />)}
      {p.calibPts.length === 2 && <Polyline positions={p.calibPts} className={"pd-calib-line"} interactive={false} />}

      {p.items.map((it) => (
        <Marker
          key={it.id}
          position={it.ll}
          draggable={p.canEdit && !p.tool}
          icon={icon(it.kind, it.label, it.id === p.selectedId, it.status)}
          zIndexOffset={it.id === p.selectedId ? 1000 : it.kind === "foh" ? 500 : 0}
          eventHandlers={{
            click: (e) => { L.DomEvent.stopPropagation(e); p.onSelect(it.id); },
            dragstart: () => p.onSelect(it.id),
            dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); p.onMove(it.id, [ll.lat, ll.lng]); },
          }}
        />
      ))}
    </MapContainer>
  );
}
