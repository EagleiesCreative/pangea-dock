import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { store } from "@/lib/db";
import { canEditRole } from "@/lib/roles";
import type { Show } from "@/lib/types";

export const dynamic = "force-dynamic";

// Top-level sections a client may write. Anything else in a patch is ignored.
const SECTIONS: (keyof Show)[] = ["event", "cues", "cameras", "inputs", "outputs", "vault", "media", "speakers", "gear", "qc", "live", "siteMap", "siteImage"];
const MAX_BYTES = 6_000_000; // floor-plan images are stored inline (compressed client-side)

function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api/show]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

async function session(req: Request) {
  const { userId, orgId: sessionOrg, orgRole: sessionRole } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;

  // The browser says which production it's on. The session token can lag behind right after switching
  // productions, so if it disagrees we confirm membership + role directly with Clerk.
  const wanted = req.headers.get("x-org-id") || sessionOrg;
  if (!wanted) return { error: NextResponse.json({ error: "No production selected" }, { status: 400 }) } as const;

  let orgRole: string | null = wanted === sessionOrg ? sessionRole ?? null : null;
  if (!orgRole) {
    try {
      const client = await clerkClient();
      const { data } = await client.users.getOrganizationMembershipList({ userId, limit: 100 });
      orgRole = data.find((m) => m.organization.id === wanted)?.role ?? null;
    } catch (e) {
      return { error: NextResponse.json({ error: `Clerk lookup failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 }) } as const;
    }
  }
  if (!orgRole) return { error: NextResponse.json({ error: "You're not a member of this production" }, { status: 403 }) } as const;
  return { userId, orgId: wanted, orgRole, canEdit: canEditRole(orgRole) } as const;
}

/** GET /api/show            → full document
 *  GET /api/show?since=12   → 204 if unchanged since version 12 (cheap polling) */
export async function GET(req: Request) {
  const s = await session(req);
  if ("error" in s) return s.error;
  let rec;
  try { rec = await store.get(s.orgId); } catch (e) { return fail(e); }
  const since = new URL(req.url).searchParams.get("since");
  if (since !== null && Number(since) >= rec.version) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ ...rec, role: s.orgRole, canEdit: s.canEdit, serverNow: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/show  body: { patch: Partial<Show> } — merges sections, returns new version. */
export async function PATCH(req: Request) {
  const s = await session(req);
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
  let rec;
  try { rec = await store.merge(s.orgId, patch, name); } catch (e) { return fail(e); }
  return NextResponse.json({ version: rec.version, updatedBy: rec.updatedBy, updatedAt: rec.updatedAt, serverNow: Date.now() });
}
