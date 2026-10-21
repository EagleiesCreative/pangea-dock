// Every list is a flat array of records with a string `id` — maps 1:1 to Supabase tables
// (cues, cameras, inputs, outputs, media, speakers, gear, qc) with `show_id` added as a FK.

export type Format = "1080p50" | "1080p59.94";
export type SignalType = "3G-SDI" | "HDMI" | "NDI" | "SRT";
export type SignalStatus = "Locked" | "No Signal" | "Testing";
export type MediaCategory =
  | "Sponsor Loop"
  | "Video Bumper (VT)"
  | "Stinger Transition"
  | "Walk-In Audio"
  | "Emergency Slate";
export type AudioMode = "AFV" | "Mute" | "Loop";
export type MediaQc = "Missing" | "Loaded" | "QC Verified";
export type GearCategory =
  | "Cameras & Optics"
  | "Video Switching & Capture"
  | "Audio & Intercom (Comms)"
  | "SDI / Fiber / Network Cabling"
  | "Power, UPS & Rigging";
export type QcDept = "Video & Color QC" | "Audio & Comms QC" | "Network, Stream & Recording QC";

export interface Cue {
  id: string;
  num: string;
  dur: string; // MM:SS
  title: string;
  source: string;
  audio: string;
  cg: string;
  notes: string;
}
export interface Camera {
  id: string;
  label: string; // CAM 1..CAM 6
  x: number; // 0..1000 plot coords
  y: number; // 0..600
  operator: string;
  body: string;
  lens: string;
  mount: string;
  framing: string;
  cable: string;
  comms: string;
  tally: string;
}
export interface InputRow {
  id: string;
  num: number;
  label: string;
  type: SignalType;
  res: string;
  ip: string;
  audio: boolean;
  status: SignalStatus;
}
export interface OutputRow {
  id: string;
  port: string;
  dest: string;
  res: string;
  cg: boolean;
}
export interface Vault {
  primary: string;
  backup: string;
  key: string;
  bitrate: string;
}
export interface MediaAsset {
  id: string;
  assetId: string;
  file: string;
  category: MediaCategory;
  dur: string;
  audio: AudioMode;
  slot: string;
  qc: MediaQc;
}
export interface Speaker {
  id: string;
  order: number;
  name: string;
  title: string;
  phonetic: string;
  cue: string;
  template: string;
}
export interface GearItem {
  id: string;
  cat: GearCategory;
  name: string;
  qty: number;
  tag: string;
  notes: string;
  packed: boolean;
  loaded: boolean;
  out: boolean;
}
export interface QcItem {
  id: string;
  dept: QcDept;
  text: string;
  done: boolean;
}

/* ---------------- Site & RF plan ---------------- */
export type SiteMode = "image" | "grid" | "geo";
export type MarkerKind = "foh" | "rx" | "wireless" | "camera" | "operator" | "stage" | "other";
export interface SiteMarker {
  id: string;
  kind: MarkerKind;
  label: string;
  operator: string;
  notes: string;
  /** Canonical position in stage metres: origin = downstage centre, x → audience-right, y → into the house. */
  s: { x: number; y: number };
  rf?: import("./rf").RfSpec | null;
}
export interface SiteMap {
  mode: SiteMode;
  envKey: string;
  n: number; // path-loss exponent
  /** Floor-plan alignment: where downstage centre sits on the image (px, y up), scale, rotation. */
  image: { originX: number; originY: number; mpp: number | null; rotDeg: number };
  /** GPS alignment: downstage centre + compass bearing from the stage toward the house. */
  geo: { lat: number; lng: number; bearingDeg: number; zoom: number; layer: "street" | "satellite" };
  showRings: boolean;
  /** Display unit for distances & positions (data is always stored in metres). */
  units?: import("./rf").Unit;
  markers: SiteMarker[];
}
/** Kept as its own top-level section so dragging markers doesn't re-upload the picture. */
export interface SiteImage { src: string | null; name: string; w: number; h: number }

export interface Show {
  event: { name: string; venue: string; format: Format; startTime: string };
  cues: Cue[];
  cameras: Camera[];
  inputs: InputRow[];
  outputs: OutputRow[];
  vault: Vault;
  media: MediaAsset[];
  speakers: Speaker[];
  gear: GearItem[];
  qc: QcItem[];
  live: { on: boolean; idx: number; startedAt: number | null };
  siteMap: SiteMap;
  siteImage: SiteImage;
}

export type ListKey = "cues" | "cameras" | "inputs" | "outputs" | "media" | "speakers" | "gear" | "qc";
