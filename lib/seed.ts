import type { Show } from "./types";
import { seedSite } from "./siteSeed";

export const DEFAULT_GEAR_CATS = ["Cameras & Optics", "Video Switching & Capture", "Audio & Intercom (Comms)", "SDI / Fiber / Network Cabling", "Power, UPS & Rigging"];

let n = 0;
const id = (p: string) => `${p}${++n}`;

export function seed(): Show {
  n = 0;
  return {
    event: {
      name: "Grand Keynote & Live Broadcast 2026",
      venue: "Jakarta Convention Center — Plenary Hall",
      format: "1080p50",
      startTime: "19:00:00",
    },
    cues: [
      { id: id("c"), kind: "section", num: "", dur: "05:00", title: "Pre-show", source: "", audio: "", cg: "", notes: "" },
      { id: id("c"), num: "S01", dur: "03:00", title: "Starting Soon slate + walk-in audio", source: "Slate / Graphics", audio: "Walk-in playlist -12dB", cg: "SLATE: Starting Soon", notes: "Hold until PD calls 'stand by'. Confirm stream is live 5 min prior." },
      { id: id("c"), num: "V01", dur: "01:30", title: "Opening VT / sponsor sting", source: "vMix VT-1", audio: "AFV (Audio Follow Video)", cg: "Sponsor bug ON", notes: "Roll VT-1 on GO. Stinger into CAM 1 at tail." },
      { id: id("c"), kind: "section", num: "", dur: "12:00", title: "Opening & keynote", source: "", audio: "", cg: "", notes: "" },
      { id: id("c"), num: "A01", dur: "02:30", title: "Host welcome", source: "CAM 1 Wide", audio: "Host Handheld 1 + BGM -15dB", cg: "LT: Host — Rina Wijaya", notes: "Wide on walk-on, push to CAM 2 on 'welcome everyone'." },
      { id: id("c"), num: "G01", dur: "08:00", title: "Keynote — CEO address", source: "CAM 2 Tight", audio: "Podium Lav 1 + FOH Matrix Mix", cg: "LT: CEO — Dr. Adi Pranata", notes: "Cut to PPT Deck on slide changes. CAM 3 jib for walk-around moments." },
      { id: id("c"), num: "V02", dur: "00:45", title: "Platinum sponsor bumper", source: "vMix VT-1", audio: "AFV (Audio Follow Video)", cg: "None", notes: "Bumper 02. Do NOT overlap with LT." },
      { id: id("c"), kind: "section", num: "", dur: "20:00", title: "Panel & product reveal", source: "", audio: "", cg: "", notes: "" },
      { id: id("c"), num: "A02", dur: "12:00", title: "Panel discussion", source: "CAM 4 Audience", audio: "Panel Handhelds 1-4 + FOH Matrix Mix", cg: "LT: Panelists ×3 (staggered)", notes: "CAM 2 on active speaker, CAM 3 wide two-shot. Moderator IFB open." },
      { id: id("c"), num: "M01", dur: "02:00", title: "Product reveal VT", source: "vMix VT-1", audio: "AFV (Audio Follow Video)", cg: "None", notes: "LED wall mirrors PGM — confirm Aux 2 routing." },
      { id: id("c"), num: "A03", dur: "06:00", title: "Live product demo", source: "Demo Laptop HDMI", audio: "Demo Lav 2 + Laptop audio -10dB", cg: "LT: Demo Lead — Sari Putri", notes: "Backup: PPT Deck if laptop signal drops." },
      { id: id("c"), num: "V03", dur: "01:00", title: "Sponsor spot loop", source: "vMix VT-1", audio: "AFV (Audio Follow Video)", cg: "Sponsor bug ON", notes: "Loop A, trim at 01:00." },
      { id: id("c"), kind: "section", num: "", dur: "10:00", title: "Q&A & close", source: "", audio: "", cg: "", notes: "" },
      { id: id("c"), num: "A04", dur: "07:00", title: "Audience Q&A", source: "CAM 4 Audience", audio: "Audience roving mic + Host Handheld 1", cg: "LT: Q&A (lower-left)", notes: "Roving operator on CAM 4 follows mic runner." },
      { id: id("c"), num: "A05", dur: "02:00", title: "Closing remarks & thanks", source: "CAM 1 Wide", audio: "Host Handheld 1 + BGM -15dB", cg: "LT: Host — Rina Wijaya", notes: "Wide for group wave. Fade BGM up on 'goodnight'." },
      { id: id("c"), num: "S02", dur: "01:00", title: "Thanks for Watching slate", source: "Slate / Graphics", audio: "Outro BGM -12dB", cg: "SLATE: Thanks for Watching", notes: "Hold 60s then stop stream." },
    ],
    cameras: [
      { id: id("cam"), label: "CAM 1", x: 500, y: 470, operator: "Budi Santoso", body: "Sony FX6", lens: "24-105mm f/4", mount: "Tripod", framing: "Wide / Master", cable: "80m 3G-SDI", comms: "Ch A", tally: "T1" },
      { id: id("cam"), label: "CAM 2", x: 330, y: 400, operator: "Dewi Lestari", body: "Sony FX9", lens: "70-200mm f/2.8", mount: "Tripod", framing: "Tight podium / MCU", cable: "70m 3G-SDI", comms: "Ch A", tally: "T2" },
      { id: id("cam"), label: "CAM 3", x: 880, y: 160, operator: "Agus Hartono", body: "Sony FX6", lens: "16-35mm f/2.8", mount: "Jib", framing: "Sweeping wide / reveal", cable: "100m SMPTE Fiber", comms: "Ch A", tally: "T3" },
      { id: id("cam"), label: "CAM 4", x: 140, y: 360, operator: "Maya Kusuma", body: "Blackmagic URSA 12K LF", lens: "24-70mm f/2.8", mount: "Gimbal", framing: "Roving / audience", cable: "NDI|HX3 wireless", comms: "Ch B", tally: "T4" },
    ],
    inputs: [
      { id: id("in"), num: 1, label: "CAM 1 Wide", type: "3G-SDI", res: "1080p50", ip: "—", audio: false, status: "Locked" },
      { id: id("in"), num: 2, label: "CAM 2 Tight", type: "3G-SDI", res: "1080p50", ip: "—", audio: false, status: "Locked" },
      { id: id("in"), num: 3, label: "CAM 3 Jib", type: "3G-SDI", res: "1080p50", ip: "—", audio: false, status: "Testing" },
      { id: id("in"), num: 4, label: "CAM 4 Audience", type: "NDI", res: "1080p50", ip: "192.168.10.44 (CAM4-GIMBAL)", audio: true, status: "Locked" },
      { id: id("in"), num: 5, label: "vMix VT-1", type: "NDI", res: "1080p50", ip: "192.168.10.20:5960 (VMIX-PLAYOUT)", audio: true, status: "Locked" },
      { id: id("in"), num: 6, label: "PPT Deck", type: "HDMI", res: "1080p60", ip: "—", audio: false, status: "Locked" },
      { id: id("in"), num: 7, label: "Demo Laptop HDMI", type: "HDMI", res: "1080p60", ip: "—", audio: true, status: "No Signal" },
      { id: id("in"), num: 8, label: "Slate / Graphics", type: "NDI", res: "1080p50", ip: "192.168.10.21 (CG-ENGINE)", audio: false, status: "Locked" },
    ],
    outputs: [
      { id: id("out"), port: "PGM", dest: "Stream Encoder", res: "1080p50", cg: true },
      { id: id("out"), port: "Clean Feed", dest: "Venue LED Wall (IMAG)", res: "1080p50", cg: false },
      { id: id("out"), port: "Aux 1", dest: "Stage DSM (Confidence Monitors)", res: "1080p50", cg: false },
      { id: id("out"), port: "Aux 2", dest: "HyperDeck ISO", res: "1080p50", cg: false },
      { id: id("out"), port: "Aux 3", dest: "HyperDeck PGM Record", res: "1080p50", cg: true },
      { id: id("out"), port: "Multiview", dest: "TD Monitor Wall", res: "1080p50", cg: true },
    ],
    vault: {
      primary: "rtmps://live.example-cdn.com:443/app",
      backup: "rtmp://backup.example-cdn.com:1935/app",
      key: "live_demo_0000_REPLACE_ME",
      bitrate: "8000",
    },
    media: [
      { id: id("m"), assetId: "SPN-001", file: "sponsor_platinum_loop_A.mp4", category: "Sponsor Loop", dur: "01:00", audio: "Loop", slot: "vMix VT-1 / Slot 3", qc: "QC Verified" },
      { id: id("m"), assetId: "VT-001", file: "opening_vt_v7_1080p50.mov", category: "Video Bumper (VT)", dur: "01:30", audio: "AFV", slot: "vMix VT-1 / Slot 1", qc: "QC Verified" },
      { id: id("m"), assetId: "STG-001", file: "brand_stinger_alpha.mov", category: "Stinger Transition", dur: "00:01", audio: "AFV", slot: "Switcher Stinger 1", qc: "Loaded" },
      { id: id("m"), assetId: "WIA-001", file: "walkin_playlist_mix.wav", category: "Walk-In Audio", dur: "30:00", audio: "Loop", slot: "vMix Audio Player", qc: "Loaded" },
      { id: id("m"), assetId: "SLT-001", file: "slate_starting_soon.png", category: "Emergency Slate", dur: "—", audio: "Mute", slot: "Switcher Still 1", qc: "QC Verified" },
      { id: id("m"), assetId: "SLT-002", file: "slate_tech_difficulties.png", category: "Emergency Slate", dur: "—", audio: "Mute", slot: "Switcher Still 2", qc: "Missing" },
    ],
    speakers: [
      { id: id("s"), order: 1, name: "Rina Wijaya", title: "Host / MC — Eagleies Live", phonetic: "REE-nah wee-JAH-yah", cue: "A01", template: "LT-Host-Left" },
      { id: id("s"), order: 2, name: "Dr. Adi Pranata", title: "Chief Executive Officer — Borneo Group", phonetic: "AH-dee prah-NAH-tah", cue: "G01", template: "LT-Keynote-2Line" },
      { id: id("s"), order: 3, name: "Maria Chen", title: "Head of Product — Nusantara Labs", phonetic: "mah-REE-ah CHEN", cue: "A02", template: "LT-Panel-2Line" },
      { id: id("s"), order: 4, name: "Sari Putri", title: "Demo Lead, Solutions Engineering", phonetic: "SAH-ree POO-tree", cue: "A03", template: "LT-Demo-1Line" },
      { id: id("s"), order: 5, name: "Yusuf Rahman", title: "Industry Analyst — TechAsia", phonetic: "YOO-soof rah-MAHN", cue: "A04", template: "LT-QA-Left" },
    ],
    gearCats: [...DEFAULT_GEAR_CATS],
    gear: [
      { id: id("g"), cat: "Cameras & Optics", name: "Sony FX6 camera body", qty: 2, tag: "CAM-FX6-01/02", notes: "Batteries ×6 each", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Cameras & Optics", name: "Sony FX9 camera body", qty: 1, tag: "CAM-FX9-01", notes: "", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Cameras & Optics", name: "70-200mm f/2.8 GM lens", qty: 1, tag: "LNS-702-01", notes: "Hood + case", packed: true, loaded: true, out: true },
      { id: id("g"), cat: "Cameras & Optics", name: "Fluid-head tripod + dolly", qty: 3, tag: "TRP-01..03", notes: "", packed: true, loaded: false, out: false },
      { id: id("g"), cat: "Video Switching & Capture", name: "ATEM 4 M/E Constellation 4K", qty: 1, tag: "SW-ATEM-01", notes: "Firmware 9.x", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Video Switching & Capture", name: "HyperDeck Studio 4K Pro", qty: 2, tag: "REC-HD-01/02", notes: "ISO + PGM record", packed: true, loaded: true, out: true },
      { id: id("g"), cat: "Video Switching & Capture", name: "vMix playout PC (RTX)", qty: 1, tag: "PC-VMIX-01", notes: "License dongle in case", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Audio & Intercom (Comms)", name: "Clear-Com FreeSpeak belt packs", qty: 6, tag: "ICM-FS-01..06", notes: "Charged, headsets ×6", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Audio & Intercom (Comms)", name: "Audio interface — Broadcast matrix return", qty: 1, tag: "AUD-IF-01", notes: "Dante / XLR from FOH", packed: true, loaded: true, out: true },
      { id: id("g"), cat: "SDI / Fiber / Network Cabling", name: "3G-SDI cable 80m reel", qty: 2, tag: "CBL-SDI-80-01/02", notes: "", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "SDI / Fiber / Network Cabling", name: "SMPTE fiber hybrid 100m", qty: 1, tag: "CBL-FBR-100", notes: "For jib camera", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "SDI / Fiber / Network Cabling", name: "Managed 1GbE switch + Cat6 kit", qty: 1, tag: "NET-SW-01", notes: "Dedicated stream VLAN", packed: true, loaded: true, out: true },
      { id: id("g"), cat: "Power, UPS & Rigging", name: "Online UPS 3kVA", qty: 2, tag: "UPS-3K-01/02", notes: "Switcher + encoder", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Power, UPS & Rigging", name: "Camera jib 3m + counterweights", qty: 1, tag: "JIB-3M-01", notes: "Rigging crew ×2", packed: true, loaded: true, out: false },
      { id: id("g"), cat: "Power, UPS & Rigging", name: "Power distro + gaffer tape kit", qty: 1, tag: "PWR-DST-01", notes: "", packed: true, loaded: false, out: false },
      { id: id("g"), cat: "Power, UPS & Rigging", name: "Spare PSU & fuse kit", qty: 1, tag: "PWR-SPR-01", notes: "", packed: false, loaded: false, out: false },
    ],
    qc: [
      { id: id("q"), dept: "Video & Color QC", text: "All cameras white-balanced to stage wash (5600K) using chip chart", done: true },
      { id: id("q"), dept: "Video & Color QC", text: "Shutter speeds locked (1/50 or 1/60) — no LED wall flicker/banding", done: true },
      { id: id("q"), dept: "Video & Color QC", text: "IMAG clean feed verified free of lower-third overlays", done: false },
      { id: id("q"), dept: "Video & Color QC", text: "Master format confirmed on every source and the switcher (1080p50)", done: false },
      { id: id("q"), dept: "Audio & Comms QC", text: "Dedicated post-fader Broadcast Matrix received from FOH", done: true },
      { id: id("q"), dept: "Audio & Comms QC", text: "Stage ambient / crowd mics tested", done: false },
      { id: id("q"), dept: "Audio & Comms QC", text: "Host IFB mix-minus verified (no program echo)", done: false },
      { id: id("q"), dept: "Audio & Comms QC", text: "All camera operators tested on Intercom Channel A", done: true },
      { id: id("q"), dept: "Network, Stream & Recording QC", text: "Dedicated wired VLAN verified (>2× upload bitrate headroom)", done: true },
      { id: id("q"), dept: "Network, Stream & Recording QC", text: "Local PGM + ISO SSD recording drives formatted and tested", done: false },
      { id: id("q"), dept: "Network, Stream & Recording QC", text: "Emergency Slates loaded in switcher standby slot", done: false },
      { id: id("q"), dept: "Network, Stream & Recording QC", text: "Main switcher and encoder plugged into UPS battery backup", done: true },
    ],
    live: { on: false, idx: 0, startedAt: null },
    ...seedSite(),
  };
}
