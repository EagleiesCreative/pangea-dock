import type { Show } from "./types";

export function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Cell = string | number | boolean | null | undefined;
export function toCsv(rows: Cell[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c == null ? "" : String(c);
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\r\n");
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "show";
const yn = (b: boolean) => (b ? "Y" : "N");

/** Single multi-section CSV. Stream key is intentionally omitted (use JSON for full backup). */
export function productionBookCsv(s: Show): string {
  const sec = (title: string, head: string[], rows: Cell[][]): Cell[][] => [["## " + title], head, ...rows, []];
  return toCsv([
    ["## EVENT"],
    ["Name", "Venue", "Format", "Master Start"],
    [s.event.name, s.event.venue, s.event.format, s.event.startTime],
    [],
    ...sec("RUN OF SHOW", ["Type", "Cue", "Duration", "Title", "Video Source", "Audio", "CG", "Notes"],
      s.cues.map((c) => (c.kind === "section" ? ["SECTION", "", c.dur, c.title, "", "", "", ""] : ["Cue", c.num, c.dur, c.title, c.source, c.audio, c.cg, c.notes]))),
    ...sec("CAMERAS", ["Label", "Operator", "Body", "Lens", "Mount", "Framing", "Cable", "Comms", "Tally", "X", "Y"],
      s.cameras.map((c) => [c.label, c.operator, c.body, c.lens, c.mount, c.framing, c.cable, c.comms, c.tally, Math.round(c.x), Math.round(c.y)])),
    ...sec("SWITCHER INPUTS", ["#", "Label", "Type", "Res/FPS", "IP / NDI", "Embedded Audio", "Status"],
      s.inputs.map((i) => [i.num, i.label, i.type, i.res, i.ip, yn(i.audio), i.status])),
    ...sec("SWITCHER OUTPUTS", ["Port", "Destination", "Res", "Include CG"],
      s.outputs.map((o) => [o.port, o.dest, o.res, yn(o.cg)])),
    ...sec("STREAM VAULT (key omitted)", ["Primary", "Backup", "Bitrate kbps"], [[s.vault.primary, s.vault.backup, s.vault.bitrate]]),
    ...sec("MEDIA", ["Asset ID", "File", "Link", "Category", "Duration", "Audio", "Slot", "QC"],
      s.media.map((m) => [m.assetId, m.file, m.link ?? "", m.category, m.dur, m.audio, m.slot, m.qc])),
    ...sec("SPEAKERS", ["Order", "Name", "Title", "Phonetic", "Cue", "CG Template", "Link"],
      s.speakers.map((p) => [p.order, p.name, p.title, p.phonetic, p.cue, p.template, p.link ?? ""])),
    ...sec("GEAR", ["Category", "Item", "Qty", "Tag", "Notes", "Packed", "Loaded In", "Packed Out"],
      s.gear.map((g) => [g.cat, g.name, g.qty, g.tag, g.notes, yn(g.packed), yn(g.loaded), yn(g.out)])),
    ...sec("PRE-FLIGHT QC", ["Department", "Check", "Done"], s.qc.map((q) => [q.dept, q.text, yn(q.done)])),
  ]);
}

/** Flat rows for binding as a vMix Data Source (JSON array of objects / CSV with header row). */
export function speakerRows(s: Show) {
  return [...s.speakers]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ Order: p.order, Name: p.name, Title: p.title, Phonetic: p.phonetic, Cue: p.cue, Template: p.template, Link: p.link ?? "" }));
}
export function speakersCsv(s: Show) {
  const rows = speakerRows(s);
  return toCsv([Object.keys(rows[0] ?? { Order: 0, Name: "", Title: "", Phonetic: "", Cue: "", Template: "", Link: "" }), ...rows.map((r) => Object.values(r))]);
}
