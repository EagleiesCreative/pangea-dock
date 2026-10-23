import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { store } from "@/lib/db";
import { displayName, fail, session } from "@/lib/session";
import type { ShareCfg } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/share (admins only)
 *   { action: "enable" }       → create a token if there isn't one
 *   { action: "regenerate" }   → new token (old links stop working)
 *   { action: "disable" }      → remove the token
 *   { action: "settings", showNotes }
 */
export async function POST(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  if (!s.isAdmin) return NextResponse.json({ error: "Only production admins can manage guest links" }, { status: 403 });
  let b: { action?: string; showNotes?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = await displayName(s.userId);
  const token = () => randomBytes(18).toString("base64url");
  try {
    const rec = await store.transact(s.orgId, (data) => {
      const cur: ShareCfg = { token: null, showNotes: false, createdAt: null, createdBy: null, ...(data.share ?? {}) };
      switch (b.action) {
        case "enable": return cur.token ? null : { share: { ...cur, token: token(), createdAt: Date.now(), createdBy: name } };
        case "regenerate": return { share: { ...cur, token: token(), createdAt: Date.now(), createdBy: name } };
        case "disable": return { share: { ...cur, token: null, createdAt: null } };
        case "settings": return { share: { ...cur, showNotes: !!b.showNotes } };
        default: return null;
      }
    }, name);
    return NextResponse.json({ ok: true, share: rec.data?.share ?? null, version: rec.version });
  } catch (e) { return fail(e); }
}
