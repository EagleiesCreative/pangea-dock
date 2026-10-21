import type { SiteImage, SiteMap } from "./types";

// Projections between canonical stage metres and each view's coordinates.
// Leaflet uses [lat, lng]; in the flat views (CRS.Simple) that's [y, x] in view units.
export type LL = [number, number];
type S = { x: number; y: number };
const D2R = Math.PI / 180;
const M_PER_DEG = 111320;

/** Scale actually used for drawing — falls back to "image width ≈ 50 m" until calibrated. */
export const effMpp = (sm: SiteMap, img: SiteImage) => sm.image.mpp ?? (img.w ? 50 / img.w : 0.05);

export function toView(s: S, sm: SiteMap, img: SiteImage): LL {
  if (sm.mode === "grid") return [-s.y, s.x];
  if (sm.mode === "image") {
    const m = effMpp(sm, img), r = sm.image.rotDeg * D2R;
    const u = s.x / m, v = -s.y / m;
    return [sm.image.originY + u * Math.sin(r) + v * Math.cos(r), sm.image.originX + u * Math.cos(r) - v * Math.sin(r)];
  }
  const t = sm.geo.bearingDeg * D2R;
  const east = s.y * Math.sin(t) - s.x * Math.cos(t);
  const north = s.y * Math.cos(t) + s.x * Math.sin(t);
  return [sm.geo.lat + north / M_PER_DEG, sm.geo.lng + east / (M_PER_DEG * Math.cos(sm.geo.lat * D2R))];
}

export function fromView([a, b]: LL, sm: SiteMap, img: SiteImage): S {
  if (sm.mode === "grid") return { x: b, y: -a };
  if (sm.mode === "image") {
    const m = effMpp(sm, img), r = sm.image.rotDeg * D2R;
    const dx = b - sm.image.originX, dy = a - sm.image.originY;
    const u = dx * Math.cos(r) + dy * Math.sin(r), v = -dx * Math.sin(r) + dy * Math.cos(r);
    return { x: u * m, y: -v * m };
  }
  const t = sm.geo.bearingDeg * D2R;
  const north = (a - sm.geo.lat) * M_PER_DEG;
  const east = (b - sm.geo.lng) * M_PER_DEG * Math.cos(sm.geo.lat * D2R);
  return { x: -east * Math.cos(t) + north * Math.sin(t), y: east * Math.sin(t) + north * Math.cos(t) };
}

/** Radius in view units for a distance in metres. */
export const radiusToView = (m: number, sm: SiteMap, img: SiteImage) => (sm.mode === "image" ? m / effMpp(sm, img) : m);

export const distM = (a: S, b: S) => Math.hypot(a.x - b.x, a.y - b.y);
export const round2 = (n: number) => Math.round(n * 100) / 100;
