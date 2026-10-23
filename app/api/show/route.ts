import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { history, EPHEMERAL, snapshot } from "@/lib/history";
import { displayName, fail, session } from "@/lib/session";
import type { Show } from "@/lib/types";

export const dynamic = "force-dynamic";

// Sections a client may write through PATCH. "share" and "comments" have their own endpoints.
const SECTIONS: (keyof Show)[] = ["event", "cues", "cameras", "inputs", "outputs", "vault", "media", "speakers", "gear", "gearCats", "qc", "live", "perfLog", "stageMsg", "siteMap", "siteImage"];
const MAX_BYTES = 6_000_000; // floor-plan images are stored inline (compressed client-side)
const timeHdr = () => ({ "Cache-Control": "no-store", "X-Server-Now": String(Date.now()) });

/** GET /api/show            → full document
 *  GET /api/show?since=12   → 204 if unchanged since version 12 (cheap polling) */
export async function GET(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  let rec;
  try { rec = await store.get(s.orgId); } catch (e) { return fail(e); }
  const since = new URL(req.url).searchParams.get("since");
  if (since !== null && Number(since) >= rec.version) return new NextResponse(null, { status: 204, headers: timeHdr() });
  return NextResponse.json({ ...rec, role: s.orgRole, canEdit: s.canEdit, serverNow: Date.now() }, { headers: timeHdr() });
}

/** PATCH /api/show  body: { patch: Partial<Show> } — merges sections, returns new version. */
export async function PATCH(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  if (!s.canEdit) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: { patch?: Record<string, unknown> };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const patch: Partial<Show> = {};
  for (const k of SECTIONS) if (body.patch && k in body.patch) (patch as Record<string, unknown>)[k] = body.patch[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Empty patch" }, { status: 400 });

  const name = await displayName(s.userId);
  const tracked = Object.keys(patch).filter((k) => !EPHEMERAL.has(k));
  let before: Partial<Show> | null = null;
  let rec;
  try {
    rec = await store.transact(s.orgId, (cur) => { before = cur; return patch; }, name);
  } catch (e) { return fail(e); }

  // Version history (best effort — never blocks saving; skipped if the history table isn't set up yet).
  // A brand-new production (nothing before) has nothing to restore to, so it isn't recorded.
  const hadData = !!before && Object.keys(before as object).length > 0;
  if (tracked.length && hadData) {
    try { await history.append(s.orgId, { version: rec.version, by: name, sections: tracked, before: snapshot(before, tracked) }); }
    catch (e) { console.warn("[history]", e instanceof Error ? e.message : e); }
  }
  return NextResponse.json({ version: rec.version, updatedBy: rec.updatedBy, updatedAt: rec.updatedAt, serverNow: Date.now() });
}
