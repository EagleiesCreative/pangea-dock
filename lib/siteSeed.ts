import type { MarkerKind, SiteImage, SiteMap, SiteMarker } from "./types";
import { presetSpec } from "./rf";

// Demo hall: 1000 × 600 px plan at 0.05 m/px → 50 m × 30 m.
const W = 1000, H = 600, MPP = 0.05;
const STAGE_FRONT_Y = 230; // svg y of the downstage edge
// Demo GPS anchor — replace by searching your venue on the Map view.
const LAT0 = -6.2133, LNG0 = 106.8023;

const planSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica,Arial,sans-serif">
<rect width="${W}" height="${H}" fill="#f7f7fa"/>
<rect x="10" y="10" width="980" height="580" rx="8" fill="none" stroke="#9aa0ad" stroke-width="4"/>
<rect x="200" y="30" width="600" height="200" rx="6" fill="#e9e9f1" stroke="#9aa0ad" stroke-width="2"/>
<rect x="240" y="40" width="520" height="14" rx="4" fill="#cfe0f2" stroke="#7aa3cc"/>
<text x="500" y="51" font-size="10" text-anchor="middle" fill="#3f6d99" letter-spacing="3">LED WALL</text>
<text x="500" y="222" font-size="12" text-anchor="middle" fill="#8a8fa0" letter-spacing="5">STAGE</text>
<rect x="465" y="130" width="70" height="40" rx="5" fill="#fff" stroke="#c9a46a"/>
<text x="500" y="154" font-size="10" text-anchor="middle" fill="#9a7433">PODIUM</text>
<g fill="#d9dae3">${Array.from({ length: 9 }, (_, r) => Array.from({ length: 34 }, (_, c) => `<circle cx="${140 + c * 22}" cy="${292 + r * 22}" r="4"/>`).join("")).join("")}</g>
<text x="500" y="285" font-size="11" text-anchor="middle" fill="#8a8fa0" letter-spacing="5">AUDIENCE</text>
<rect x="420" y="510" width="160" height="60" rx="6" fill="#fff" stroke="#5aa69c" stroke-width="2"/>
<text x="500" y="545" font-size="11" text-anchor="middle" fill="#2e7d73" letter-spacing="2">FOH</text>
<rect x="10" y="520" width="90" height="70" fill="#eceef3" stroke="#9aa0ad"/>
<text x="55" y="560" font-size="9" text-anchor="middle" fill="#8a8fa0">LOBBY</text>
<text x="980" y="584" font-size="10" text-anchor="end" fill="#a0a4b0">Demo plan · 50 m × 30 m</text>
</svg>`;

function at(id: string, kind: MarkerKind, label: string, xs: number, ys: number, extra: Partial<SiteMarker> = {}): SiteMarker {
  return { id, kind, label, operator: "", notes: "", s: { x: +((xs - W / 2) * MPP).toFixed(2), y: +((ys - STAGE_FRONT_Y) * MPP).toFixed(2) }, rf: null, ...extra };
}

export function seedSite(): { siteMap: SiteMap; siteImage: SiteImage } {
  const FOH = "sm-foh";
  const rf = (k: string, over: Partial<ReturnType<typeof presetSpec>> = {}) => ({ ...presetSpec(k, FOH), ...over });
  return {
    siteImage: { src: `data:image/svg+xml;utf8,${encodeURIComponent(planSvg)}`, name: "Demo hall plan", w: W, h: H },
    siteMap: {
      mode: "image",
      envKey: "venue",
      n: 2.4,
      image: { originX: W / 2, originY: H - STAGE_FRONT_Y, mpp: MPP, rotDeg: 0 },
      geo: { lat: LAT0, lng: LNG0, bearingDeg: 180, zoom: 19, layer: "street" },
      showRings: false,
      markers: [
        at(FOH, "foh", "FOH / Broadcast booth", 500, 540, { notes: "Switcher, audio desk, wireless receivers" }),
        at("sm-ds", "stage", "Downstage centre", 500, 230),
        at("sm-host", "wireless", "Host HH 1", 545, 190, { operator: "Rina Wijaya", rf: rf("uhf-mic") }),
        at("sm-panel", "wireless", "Panel HH 1–4", 380, 190, { rf: rf("uhf-mic") }),
        at("sm-demo", "wireless", "Demo Lav 2", 650, 180, { operator: "Sari Putri", rf: rf("uhf-mic") }),
        at("sm-iem", "wireless", "Band IEM pack", 300, 120, { rf: rf("uhf-iem") }),
        at("sm-sm", "operator", "Stage manager", 230, 250, { operator: "Agus", rf: rf("dect") }),
        at("sm-cam1", "camera", "CAM 1 Wide", 500, 470, { operator: "Budi Santoso" }),
        at("sm-cam2", "camera", "CAM 2 Tight", 330, 400, { operator: "Dewi Lestari" }),
        at("sm-cam3", "camera", "CAM 3 Jib", 880, 160, { operator: "Agus Hartono", rf: rf("dect") }),
        at("sm-cam4", "camera", "CAM 4 Gimbal", 140, 360, { operator: "Maya Kusuma", rf: rf("video-5g") }),
        at("sm-foyer", "camera", "Foyer interview cam", 40, 575, { notes: "Behind the lobby wall", rf: rf("wifi-ndi", { extraLossDb: 21 }) }),
      ],
    },
  };
}
