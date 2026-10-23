import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { history, OMITTED, snapshot } from "@/lib/history";
import { displayName, fail, session } from "@/lib/session";
import type { Show } from "@/lib/types";

export const dynamic = "force-dynamic";

const setupHint = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /PGRST205|pangea_history|not set up/i.test(m) ? "Version history isn't set up yet — run supabase/migrations/0002_history.sql in the Supabase SQL Editor." : m;
};

/** GET /api/history → recent entries (metadata only). */
export async function GET(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  try { return NextResponse.json({ entries: await history.list(s.orgId, 120) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return NextResponse.json({ error: setupHint(e), entries: [] }, { status: 200 }); }
}

/** POST /api/history { action: "restore", id } → put those sections back the way they were before that entry. Editors only. */
export async function POST(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  if (!s.canEdit) return NextResponse.json({ error: "View-only access" }, { status: 403 });
  let b: { action?: string; id?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (b.action !== "restore" || !b.id) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const entry = await history.get(s.orgId, b.id);
    if (!entry?.before) return NextResponse.json({ error: "That version can't be found" }, { status: 404 });
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry.before)) {
      if (v === null || (typeof v === "object" && v && (v as unknown as typeof OMITTED).__omitted)) continue; // e.g. the floor-plan image
      patch[k] = v;
    }
    const keys = Object.keys(patch);
    if (!keys.length) return NextResponse.json({ error: "Nothing restorable in that version" }, { status: 400 });
    const name = await displayName(s.userId);
    let before: Partial<Show> | null = null;
    const rec = await store.transact(s.orgId, (cur) => { before = cur; return patch as Partial<Show>; }, name);
    try { await history.append(s.orgId, { version: rec.version, by: name, sections: keys, before: snapshot(before, keys), note: `Restored to before v${entry.version}` }); } catch {}
    return NextResponse.json({ ok: true, version: rec.version, restored: keys });
  } catch (e) { return fail(new Error(setupHint(e))); }
}
