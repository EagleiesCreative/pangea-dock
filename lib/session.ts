import "server-only";
import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { canEditRole, isAdminRole } from "./roles";

export function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api]", message);
  return NextResponse.json({ error: message }, { status });
}

export type Session = { userId: string; orgId: string; orgRole: string; canEdit: boolean; isAdmin: boolean };

/** Signed-in member of the requested production (X-Org-Id header, falling back to the session's active org). */
export async function session(req: Request): Promise<{ error: NextResponse } | Session> {
  const { userId, orgId: sessionOrg, orgRole: sessionRole } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };

  // The session token can lag right after switching productions, so if it disagrees we ask Clerk directly.
  const wanted = req.headers.get("x-org-id") || sessionOrg;
  if (!wanted) return { error: NextResponse.json({ error: "No production selected" }, { status: 400 }) };

  let orgRole: string | null = wanted === sessionOrg ? sessionRole ?? null : null;
  if (!orgRole) {
    try {
      const client = await clerkClient();
      const { data } = await client.users.getOrganizationMembershipList({ userId, limit: 100 });
      orgRole = data.find((m) => m.organization.id === wanted)?.role ?? null;
    } catch (e) {
      return { error: NextResponse.json({ error: `Clerk lookup failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 }) };
    }
  }
  if (!orgRole) return { error: NextResponse.json({ error: "You're not a member of this production" }, { status: 403 }) };
  return { userId, orgId: wanted, orgRole, canEdit: canEditRole(orgRole), isAdmin: isAdminRole(orgRole) };
}

export async function displayName(fallback: string) {
  const user = await currentUser();
  return user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || fallback;
}
