import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Show } from "./types";
import { supaFail, supabaseHeaders } from "./db";

/**
 * Version history — one row per edit burst: who, when, which sections, and those sections' values *before* the edit
 * (so any entry can be restored). Rapid edits by the same person to the same sections within COALESCE_MS are folded
 * into one entry that keeps the oldest "before".
 * Supabase: table `pangea_history` (supabase/migrations/0002_history.sql). Local dev: ./.data/history/<org>.json.
 */
export interface HistoryEntry {
  id: string;
  version: number;
  by: string;
  at: string;       // last edit in this burst
  startedAt: string;
  sections: string[];
  note?: string | null;
  before?: Partial<Show>;
}

const COALESCE_MS = 90_000;
const KEEP = 300;
/** Show-time noise that shouldn't clutter history (or be "restored"). */
export const EPHEMERAL = new Set(["live", "perfLog", "stageMsg", "comments", "share"]);
export const OMITTED = { __omitted: true } as const;

export interface HistoryStore {
  append(orgId: string, e: Omit<HistoryEntry, "id" | "at" | "startedAt">): Promise<void>;
  list(orgId: string, limit?: number): Promise<HistoryEntry[]>;
  get(orgId: string, id: string): Promise<HistoryEntry | null>;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/* ---------- file ---------- */
const DIR = path.join(process.cwd(), ".data", "history");
const fileOf = (orgId: string) => path.join(DIR, orgId.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
async function readAll(orgId: string): Promise<HistoryEntry[]> {
  try { return JSON.parse(await fs.readFile(fileOf(orgId), "utf8")); } catch { return []; }
}
const fileHistory: HistoryStore = {
  async append(orgId, e) {
    const all = await readAll(orgId);
    const last = all[all.length - 1];
    const now = new Date().toISOString();
    if (last && !e.note && !last.note && last.by === e.by && same(last.sections, e.sections) && Date.now() - Date.parse(last.at) < COALESCE_MS) {
      last.at = now; last.version = e.version;
    } else {
      all.push({ ...e, id: Math.random().toString(36).slice(2, 10), at: now, startedAt: now });
    }
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(fileOf(orgId), JSON.stringify(all.slice(-KEEP)));
  },
  async list(orgId, limit = 100) {
    return (await readAll(orgId)).slice(-limit).reverse().map(({ before: _b, ...m }) => m);
  },
  async get(orgId, id) {
    return (await readAll(orgId)).find((x) => x.id === id) ?? null;
  },
};

/* ---------- supabase ---------- */
function supaHistory(url: string, key: string): HistoryStore {
  const h = supabaseHeaders(key);
  const T = `${url}/rest/v1/pangea_history`;
  type Row = { id: number; org_id: string; version: number; updated_by: string; created_at: string; updated_at: string; sections: string[]; note: string | null; before?: Partial<Show> };
  const toEntry = (r: Row): HistoryEntry => ({ id: String(r.id), version: r.version, by: r.updated_by, at: r.updated_at, startedAt: r.created_at, sections: r.sections, note: r.note, before: r.before });
  return {
    async append(orgId, e) {
      const lastRes = await fetch(`${T}?org_id=eq.${encodeURIComponent(orgId)}&select=id,updated_by,sections,updated_at,note&order=id.desc&limit=1`, { headers: h, cache: "no-store" });
      if (!lastRes.ok) await supaFail("history read", lastRes);
      const last = (await lastRes.json())[0] as Row | undefined;
      const now = new Date().toISOString();
      if (last && !e.note && !last.note && last.updated_by === e.by && same(last.sections, e.sections) && Date.now() - Date.parse(last.updated_at) < COALESCE_MS) {
        const r = await fetch(`${T}?id=eq.${last.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ updated_at: now, version: e.version }), cache: "no-store" });
        if (!r.ok) await supaFail("history save", r);
        return;
      }
      const r = await fetch(T, { method: "POST", headers: h, cache: "no-store",
        body: JSON.stringify({ org_id: orgId, version: e.version, updated_by: e.by, sections: e.sections, note: e.note ?? null, before: e.before ?? {}, created_at: now, updated_at: now }) });
      if (!r.ok) await supaFail("history save", r);
    },
    async list(orgId, limit = 100) {
      const r = await fetch(`${T}?org_id=eq.${encodeURIComponent(orgId)}&select=id,org_id,version,updated_by,created_at,updated_at,sections,note&order=id.desc&limit=${limit}`, { headers: h, cache: "no-store" });
      if (!r.ok) await supaFail("history read", r);
      return ((await r.json()) as Row[]).map(toEntry);
    },
    async get(orgId, id) {
      if (!/^\d+$/.test(id)) return null;
      const r = await fetch(`${T}?org_id=eq.${encodeURIComponent(orgId)}&id=eq.${id}&select=*`, { headers: h, cache: "no-store" });
      if (!r.ok) await supaFail("history read", r);
      const row = (await r.json())[0] as Row | undefined;
      return row ? toEntry(row) : null;
    },
  };
}

export const history: HistoryStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_")
    ? supaHistory(process.env.SUPABASE_URL.replace(/\/$/, ""), process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileHistory;

/** Snapshot the given sections from `data` for an entry's "before" (big blobs like the floor-plan image are omitted). */
export function snapshot(data: Partial<Show> | null, sections: string[]): Partial<Show> {
  const out: Record<string, unknown> = {};
  for (const k of sections) out[k] = k === "siteImage" ? OMITTED : (data as Record<string, unknown> | null)?.[k] ?? null;
  return out as Partial<Show>;
}
