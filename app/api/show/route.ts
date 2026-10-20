import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { store } from "@/lib/db";
import { canEditRole } from "@/lib/roles";
import type { Show } from "@/lib/types";

export const dynamic = "force-dynamic";

// Top-level sections a client may write. Anything else in a patch is ignored.
const SECTIONS: (keyof Show)[] = ["event", "cues", "cameras", "inputs", "outputs", "vault", "media", "speakers", "gear", "qc", "live"];
const MAX_BYTES = 2_000_000;

async function session() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  if (!orgId) return { error: NextResponse.json({ error: "No production selected" }, { status: 400 }) } as const;
  return { userId, orgId, orgRole: orgRole ?? null, canEdit: canEditRole(orgRole) } as const;
}

/** GET /api/show            → full document
 *  GET /api/show?since=12   → 204 if unchanged since version 12 (cheap polling) */
export async function GET(req: Request) {
  const s = await session();
  if ("error" in s) return s.error;
  const rec = await store.get(s.orgId);
  const since = new URL(req.url).searchParams.get("since");
  if (since !== null && Number(since) >= rec.version) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ ...rec, role: s.orgRole, canEdit: s.canEdit, serverNow: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/show  body: { patch: Partial<Show> } — merges sections, returns new version. */
export async function PATCH(req: Request) {
  const s = await session();
  if ("error" in s) return s.error;
  if (!s.canEdit) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: { patch?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Partial<Show> = {};
  for (const k of SECTIONS) if (body.patch && k in body.patch) (patch as Record<string, unknown>)[k] = body.patch[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Empty patch" }, { status: 400 });

  const user = await currentUser();
  const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || s.userId;
  const rec = await store.merge(s.orgId, patch, name);
  return NextResponse.json({ version: rec.version, updatedBy: rec.updatedBy, updatedAt: rec.updatedAt, serverNow: Date.now() });
}
