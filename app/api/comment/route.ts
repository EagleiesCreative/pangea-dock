import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { displayName, fail, session } from "@/lib/session";
import type { CueComment } from "@/lib/types";

export const dynamic = "force-dynamic";
const rid = () => Math.random().toString(36).slice(2, 10);

/**
 * POST /api/comment — any member (viewers too) can comment on a cue.
 *   { action: "add", cueId, text }
 *   { action: "resolve", id, resolved }   — author or editor
 *   { action: "delete", id }              — author or editor
 */
export async function POST(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  let b: { action?: string; cueId?: string; text?: string; id?: string; resolved?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = await displayName(s.userId);
  let denied = false;
  try {
    const rec = await store.transact(s.orgId, (data) => {
      const list: CueComment[] = Array.isArray(data.comments) ? [...data.comments] : [];
      if (b.action === "add") {
        const text = (b.text ?? "").trim().slice(0, 2000);
        if (!text || !b.cueId) return null;
        return { comments: [...list, { id: rid(), cueId: b.cueId, text, by: name, byId: s.userId, at: Date.now(), resolved: false }].slice(-2000) };
      }
      const i = list.findIndex((c) => c.id === b.id);
      if (i < 0) return null;
      if (list[i].byId !== s.userId && !s.canEdit) { denied = true; return null; }
      if (b.action === "resolve") { list[i] = { ...list[i], resolved: !!b.resolved }; return { comments: list }; }
      if (b.action === "delete") return { comments: list.filter((c) => c.id !== b.id) };
      return null;
    }, name);
    if (denied) return NextResponse.json({ error: "Only the author or an editor can change this comment" }, { status: 403 });
    return NextResponse.json({ ok: true, version: rec.version });
  } catch (e) { return fail(e); }
}
