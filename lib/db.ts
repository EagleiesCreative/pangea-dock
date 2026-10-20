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
function supabaseStore(url: string, key: string): ShowStore {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const toRecord = (r: { data: Partial<Show> | null; version: number; updated_by: string | null; updated_at: string | null } | undefined): ShowRecord =>
    r ? { data: r.data, version: r.version, updatedBy: r.updated_by, updatedAt: r.updated_at } : empty;
  return {
    async get(orgId) {
      const res = await fetch(`${url}/rest/v1/pangea_shows?org_id=eq.${encodeURIComponent(orgId)}&select=data,version,updated_by,updated_at`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`Supabase get failed: ${res.status} ${await res.text()}`);
      return toRecord((await res.json())[0]);
    },
    async merge(orgId, patch, user) {
      const res = await fetch(`${url}/rest/v1/rpc/pangea_merge_show`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_org: orgId, p_patch: patch, p_user: user }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Supabase merge failed: ${res.status} ${await res.text()}`);
      const rows = await res.json();
      return toRecord(Array.isArray(rows) ? rows[0] : rows);
    },
  };
}

export const store: ShowStore =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStore(process.env.SUPABASE_URL.replace(/\/$/, ""), process.env.SUPABASE_SERVICE_ROLE_KEY)
    : fileStore;
