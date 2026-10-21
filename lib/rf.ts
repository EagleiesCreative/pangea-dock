// RF reach estimate — log-distance path-loss link budget.
//
//   PL(d)  = FSPL(1 m, f) + 10·n·log10(d)          FSPL(1 m) = 20·log10(f_MHz) − 27.55 dB
//   Prx    = Ptx + Gtx + Grx − extraLoss − PL(d)
//   margin = Prx − sensitivity        (needs ≥ fadeMargin for a solid link)
//   range(m) = 10^((Ptx + Gtx + Grx − extra − sens − m − FSPL1m) / (10·n))
//
// "Rated range" mode: instead of dBm figures, enter the manufacturer's line-of-sight range
// (e.g. Vaxis Storm 1000 → 1000 ft). We treat it as the solid range in open air (n = 2) and
// scale it to the chosen environment: range_env = R_rated^(2/n), minus any extra loss.
//
// This is a planning estimate: real reach depends on walls, LED walls, crowd density, antenna placement
// and local RF noise. Always walk-test.

export interface RfSpec {
  preset: string;
  freqMHz: number;
  txDbm: number;
  txGainDbi: number;
  rxGainDbi: number;
  sensDbm: number;
  extraLossDb: number; // body / crowd / cable loss
  fadeMarginDb: number;
  targetId: string | null; // receiver marker (defaults to first FOH)
  /** When set, range comes from the manufacturer's rated LOS distance instead of the dBm budget. */
  rated?: { value: number; unit: Unit } | null;
}

export type Unit = "m" | "ft";
export const FT = 0.3048;
export const toM = (v: number, u: Unit) => (u === "ft" ? v * FT : v);
export const fromM = (m: number, u: Unit) => (u === "ft" ? m / FT : m);

export interface RfPreset extends Omit<RfSpec, "preset" | "targetId"> { key: string; label: string; group?: string }

export const RF_PRESETS: RfPreset[] = [
  { key: "uhf-mic", label: "UHF wireless mic (HH / bodypack)", freqMHz: 600, txDbm: 17, txGainDbi: 0, rxGainDbi: 0, sensDbm: -90, extraLossDb: 10, fadeMarginDb: 20 },
  { key: "uhf-iem", label: "UHF in-ear monitor (IEM)", freqMHz: 600, txDbm: 17, txGainDbi: 0, rxGainDbi: 0, sensDbm: -90, extraLossDb: 10, fadeMarginDb: 20 },
  { key: "digi-24", label: "2.4 GHz digital mic", freqMHz: 2440, txDbm: 10, txGainDbi: 0, rxGainDbi: 0, sensDbm: -92, extraLossDb: 6, fadeMarginDb: 12 },
  { key: "dect", label: "DECT intercom beltpack (1.9 GHz)", freqMHz: 1900, txDbm: 24, txGainDbi: 0, rxGainDbi: 0, sensDbm: -93, extraLossDb: 10, fadeMarginDb: 20 },
  { key: "video-5g", label: "Wireless video TX (5 GHz)", freqMHz: 5800, txDbm: 20, txGainDbi: 2, rxGainDbi: 2, sensDbm: -82, extraLossDb: 6, fadeMarginDb: 12 },
  { key: "wifi-ndi", label: "Wi-Fi / NDI camera (5 GHz)", freqMHz: 5500, txDbm: 20, txGainDbi: 2, rxGainDbi: 3, sensDbm: -70, extraLossDb: 6, fadeMarginDb: 10 },
  { key: "custom", label: "Custom (dBm specs)", freqMHz: 600, txDbm: 17, txGainDbi: 0, rxGainDbi: 0, sensDbm: -90, extraLossDb: 0, fadeMarginDb: 15 },
  // Rated-range presets — manufacturer line-of-sight figures (check your exact model / firmware).
  { key: "vaxis-1000", group: "rated", label: "Vaxis Storm 1000 — 1000 ft", freqMHz: 5800, txDbm: 20, txGainDbi: 0, rxGainDbi: 0, sensDbm: -82, extraLossDb: 0, fadeMarginDb: 6, rated: { value: 1000, unit: "ft" } },
  { key: "vaxis-3000", group: "rated", label: "Vaxis Storm 3000 — 3000 ft", freqMHz: 5800, txDbm: 20, txGainDbi: 0, rxGainDbi: 0, sensDbm: -82, extraLossDb: 0, fadeMarginDb: 6, rated: { value: 3000, unit: "ft" } },
  { key: "teradek-750", group: "rated", label: "Teradek Bolt 4K 750 — 750 ft", freqMHz: 5800, txDbm: 20, txGainDbi: 0, rxGainDbi: 0, sensDbm: -82, extraLossDb: 0, fadeMarginDb: 6, rated: { value: 750, unit: "ft" } },
  { key: "hollyland-400", group: "rated", label: "Hollyland Mars 400S Pro — 400 ft", freqMHz: 5800, txDbm: 20, txGainDbi: 0, rxGainDbi: 0, sensDbm: -82, extraLossDb: 0, fadeMarginDb: 6, rated: { value: 400, unit: "ft" } },
  { key: "rated-custom", group: "rated", label: "Custom rated range", freqMHz: 5800, txDbm: 20, txGainDbi: 0, rxGainDbi: 0, sensDbm: -82, extraLossDb: 0, fadeMarginDb: 6, rated: { value: 300, unit: "m" } },
];

export const ENVIRONMENTS = [
  { key: "open", label: "Open air, clear line of sight", n: 2.0 },
  { key: "venue", label: "Indoor venue, line of sight", n: 2.4 },
  { key: "crowd", label: "Dense crowd / partial obstruction", n: 2.8 },
  { key: "walls", label: "Through walls / heavy obstruction", n: 3.3 },
] as const;

export const presetSpec = (key: string, targetId: string | null = null): RfSpec => {
  const p = RF_PRESETS.find((x) => x.key === key) ?? RF_PRESETS[0];
  const { key: k, label: _l, group: _g, ...rest } = p;
  return { preset: k, targetId, ...rest, rated: rest.rated ? { ...rest.rated } : null };
};

export const mwToDbm = (mw: number) => 10 * Math.log10(Math.max(mw, 1e-6));
export const dbmToMw = (dbm: number) => Math.pow(10, dbm / 10);

const fspl1m = (fMHz: number) => 20 * Math.log10(Math.max(fMHz, 1)) - 27.55;
const budget = (s: RfSpec) => s.txDbm + s.txGainDbi + s.rxGainDbi - s.extraLossDb;
export const ratedM = (s: RfSpec) => (s.rated && s.rated.value > 0 ? toM(s.rated.value, s.rated.unit) : null);

/** Headroom above the fade margin at 1 m — everything else is 10·n·log10(d). */
function h0(s: RfSpec) {
  const r = ratedM(s);
  if (r != null) return 20 * Math.log10(r) - s.extraLossDb; // rated range = solid range at n = 2
  return budget(s) - s.sensDbm - s.fadeMarginDb - fspl1m(s.freqMHz);
}
/** Margin above sensitivity (dB) at distance d. */
export const marginAt = (s: RfSpec, distM: number, n: number) => h0(s) + s.fadeMarginDb - 10 * n * Math.log10(Math.max(distM, 1));
export const rxPower = (s: RfSpec, distM: number, n: number) => s.sensDbm + marginAt(s, distM, n);
/** Distance (m) at which the link has exactly `marginDb` above sensitivity. */
export const rangeAt = (s: RfSpec, n: number, marginDb: number) => Math.pow(10, (h0(s) + s.fadeMarginDb - marginDb) / (10 * n));

export type LinkStatus = "ok" | "marginal" | "fail" | "unknown";
export interface LinkResult {
  distM: number | null;
  rxDbm: number | null;
  marginDb: number | null;
  status: LinkStatus;
  solidRangeM: number; // margin == fadeMargin
  maxRangeM: number;   // margin == 0
}

export function evaluate(s: RfSpec, distM: number | null, n: number): LinkResult {
  const solidRangeM = rangeAt(s, n, s.fadeMarginDb);
  const maxRangeM = rangeAt(s, n, 0);
  if (distM == null) return { distM, rxDbm: null, marginDb: null, status: "unknown", solidRangeM, maxRangeM };
  const marginDb = marginAt(s, distM, n);
  const rxDbm = s.sensDbm + marginDb;
  const status: LinkStatus = marginDb >= s.fadeMarginDb ? "ok" : marginDb >= 0 ? "marginal" : "fail";
  return { distM, rxDbm, marginDb, status, solidRangeM, maxRangeM };
}

export const fmtM = (m: number | null) => fmtDist(m, "m");
export function fmtDist(m: number | null, u: Unit = "m") {
  if (m == null) return "—";
  if (u === "ft") { const f = m / FT; return f >= 5280 ? `${(f / 5280).toFixed(2)} mi` : `${f < 10 ? f.toFixed(1) : Math.round(f).toLocaleString()} ft`; }
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m < 10 ? m.toFixed(1) : Math.round(m)} m`;
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371008.8, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
