import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Show } from "./types";

/**
 * Show storage. One JSON document per production (Clerk org id).
 * Writes are per-section merges (`data = data || patch`), so two crew members
 * editing different sections at the same time never overwrite each other.
 *
 * - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set → Supabase Postgres (see supabase/migrations).
 * - Otherwise → local JSON files in ./.data (fine for `npm run dev` / a single self-hosted box,
 *   NOT for serverless hosts like Vercel whose filesystem is read-only).
 */
export interface ShowRecord {
  data: Partial<Show> | null;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ShowStore {
  get(orgId: string): Promise<ShowRecord>;
  merge(orgId: string, patch: Partial<Show>, user: string): Promise<ShowRecord>;
}

/* ---------------- Local file adapter ---------------- */
const DIR = path.join(process.cwd(), ".data", "shows");
const file = (orgId: string) => path.join(DIR, orgId.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
const empty: ShowRecord = { data: null, version: 0, updatedBy: null, updatedAt: null };
let chain: Promise<unknown> = Promise.resolve(); // serialise writes within this process

const fileStore: ShowStore = {
  async get(orgId) {
    try {
      return JSON.parse(await fs.readFile(file(orgId), "utf8")) as ShowRecord;
    } catch {
      return empty;
    }
  },
  merge(orgId, patch, user) {
    const run = async () => {
      const cur = await fileStore.get(orgId);
      const next: ShowRecord = {
        data: { ...(cur.data ?? {}), ...patch },
        version: cur.version + 1,
        updatedBy: user,
        updatedAt: new Date().toISOString(),
      };
      await fs.mkdir(DIR, { recursive: true });
      const tmp = file(orgId) + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(next));
      await fs.rename(tmp, file(orgId));
      return next;
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  },
};

/* ---------------- Supabase adapter (PostgREST) ---------------- */
async function supaFail(what: string, res: Response): Promise<never> {
  const body = await res.text();
  if (body.includes("PGRST205"))
    throw new Error("Database not set up — run supabase/setup.sql in the Supabase SQL Editor, then reload.");
  if (res.status === 401 || res.status === 403 || body.includes("42501")) throw new Error("Supabase permission denied — SUPABASE_SERVICE_ROLE_KEY must be the secret / service_role key, not the publishable/anon key.");
  throw new Error(`Supabase ${what} failed (${res.status}): ${body.slice(0, 160)}`);
}

function supabaseStore(url: string, key: string): ShowStore {
  if (key.startsWith("sb_publishable_")) {
    const msg = "SUPABASE_SERVICE_ROLE_KEY is the publishable key — use the secret key (sb_secret_…) from Supabase → Project Settings → API Keys.";
    return { get: async () => { throw new Error(msg); }, merge: async () => { throw new Error(msg); } };
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const toRecord = (r: { data: Partial<Show> | null; version: number; updated_by: string | null; updated_at: string | null } | undefined): ShowRecord =>
    r ? { data: r.data, version: r.version, updatedBy: r.updated_by, updatedAt: r.updated_at } : empty;
  return {
    async get(orgId) {
      const res = await fetch(`${url}/rest/v1/pangea_shows?org_id=eq.${encodeURIComponent(orgId)}&select=data,version,updated_by,updated_at`, { headers, cache: "no-store" });
      if (!res.ok) await supaFail("read", res);
      return toRecord((await res.json())[0]);
    },
    // Optimistic read-modify-write: the UPDATE only applies if `version` is unchanged since we read it,
    // so two simultaneous saves can't silently overwrite each other — the loser re-reads and re-merges.
    async merge(orgId, patch, user) {
      const rep = { ...headers, Prefer: "return=representation" };
      const sel = "select=data,version,updated_by,updated_at";
      for (let attempt = 0; attempt < 6; attempt++) {
        const cur = await this.get(orgId);
        const now = new Date().toISOString();
        if (cur.version === 0 && cur.data === null) {
          const res = await fetch(`${url}/rest/v1/pangea_shows?${sel}`, {
            method: "POST", headers: rep, cache: "no-store",
            body: JSON.stringify({ org_id: orgId, data: patch, version: 1, updated_by: user, updated_at: now }),
          });
          if (res.status === 409) continue; // someone created it first — retry as an update
          if (!res.ok) await supaFail("save", res);
          return toRecord((await res.json())[0]);
        }
        const res = await fetch(`${url}/rest/v1/pangea_shows?org_id=eq.${encodeURIComponent(orgId)}&version=eq.${cur.version}&${sel}`, {
          method: "PATCH", headers: rep, cache: "no-store",
          body: JSON.stringify({ data: { ...(cur.data ?? {}), ...patch }, version: cur.version + 1, updated_by: user, updated_at: now }),
        });
        if (!res.ok) await supaFail("save", res);
        const rows = await res.json();
        if (rows.length) return toRecord(rows[0]);
        await new Promise((r) => setTimeout(r, 40 + Math.random() * 80)); // version moved — retry
      }
      throw new Error("Save conflicted repeatedly — please try again.");
    },
  };
}

export const store: ShowStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore(process.env.SUPABASE_URL.replace(/\/$/, ""), process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileStore;
