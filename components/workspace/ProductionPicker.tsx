"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { ArrowRight, Loader2, LogOut, Mail, Plus } from "lucide-react";
import { AuthLayout, Brand, ErrorText, Field, Input, Primary, Title, clerkError } from "@/components/auth/kit";
import { roleLabel } from "@/lib/roles";

type Membership = { id: string; role: string; organization: { id: string; name: string } };
type Invite = { id: string; role: string; publicOrganizationData: { id: string; name: string }; accept: () => Promise<{ publicOrganizationData: { id: string } }> };

/**
 * Pick / create / accept-invite for a production (Clerk organization).
 * Talks to the Clerk object directly so it also works while the session is still "pending"
 * (Clerk's "choose-organization" task) — the hooks treat pending sessions as signed out.
 */
export function ProductionPicker({ redirectTo = "/" }: { redirectTo?: string }) {
  const clerk = useClerk();
  const [loaded, setLoaded] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const user = clerk.user;

  const load = useCallback(async () => {
    if (!clerk.user) return;
    try {
      const [m, i] = await Promise.all([
        clerk.user.getOrganizationMemberships({ pageSize: 100 }),
        clerk.user.getOrganizationInvitations({ status: "pending", pageSize: 50 }),
      ]);
      setMemberships(m.data as unknown as Membership[]);
      setInvites(i.data as unknown as Invite[]);
    } catch (e) { setError(clerkError(e)); }
    finally { setLoaded(true); }
  }, [clerk.user]);

  useEffect(() => { if (clerk.loaded) load(); }, [clerk.loaded, load]);

  const activate = async (orgId: string) => {
    await clerk.setActive({ organization: orgId });
    window.location.assign(redirectTo); // full reload so server + middleware see the active session
  };
  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id); setError("");
    try { await fn(); } catch (e) { setError(clerkError(e)); setBusy(""); }
  };

  const noneYet = loaded && !memberships.length && !invites.length;

  return (
    <AuthLayout>
      <Brand />
      <Title title="Choose a production" sub={user ? `Signed in as ${user.primaryEmailAddress?.emailAddress ?? user.fullName ?? "you"}` : undefined} />
      {!loaded ? <div className="flex justify-center py-8 text-fg-muted"><Loader2 className="animate-spin" /></div> : (
        <div className="space-y-4">
          {invites.length > 0 && (
            <div className="space-y-2">
              <div className="label">Invitations</div>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-3.5 py-3">
                  <Mail size={16} className="shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-fg">{inv.publicOrganizationData.name}</div>
                    <div className="text-xs text-fg-muted">Join as {roleLabel(inv.role)}</div>
                  </div>
                  <button disabled={!!busy} onClick={() => run(inv.id, async () => { const r = await inv.accept(); await activate(r.publicOrganizationData.id); })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-inverse px-3 text-xs font-semibold text-on-inverse transition hover:opacity-90 disabled:opacity-50">
                    {busy === inv.id ? <Loader2 size={13} className="animate-spin" /> : null}Accept
                  </button>
                </div>
              ))}
            </div>
          )}

          {memberships.length > 0 && (
            <div className="space-y-2">
              <div className="label">Your productions</div>
              {memberships.map((m) => (
                <button key={m.id} disabled={!!busy} onClick={() => run(m.id, () => activate(m.organization.id))}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition hover:bg-raise disabled:opacity-60">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand">{m.organization.name[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{m.organization.name}</span>
                    <span className="block text-xs text-fg-muted">{roleLabel(m.role)}</span>
                  </span>
                  {busy === m.id ? <Loader2 size={16} className="animate-spin text-fg-muted" /> : <ArrowRight size={16} className="text-fg-muted" />}
                </button>
              ))}
            </div>
          )}

          {noneYet && <p className="rounded-xl bg-raise px-3.5 py-3 text-[13px] text-fg-muted">You're not part of any production yet. Create one, or ask an admin to invite <b className="text-fg">{user?.primaryEmailAddress?.emailAddress}</b>.</p>}

          {!showNew && !noneYet ? (
            <button className="btn w-full justify-center !py-3" onClick={() => setShowNew(true)}><Plus size={14} /> New production</button>
          ) : (
            <form className="space-y-3 rounded-xl border border-line p-3.5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run("new", async () => { const o = await clerk.createOrganization({ name: name.trim() }); await activate(o.id); }); }}>
              <Field label="New production name"><Input placeholder="e.g. Grand Keynote 2026" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Primary type="submit" loading={busy === "new"} disabled={!name.trim()}>Create production</Primary>
            </form>
          )}

          <ErrorText>{error}</ErrorText>
          <button onClick={() => clerk.signOut({ redirectUrl: "/sign-in" })} className="mx-auto flex items-center gap-1.5 pt-2 text-[13px] font-medium text-fg-muted hover:text-fg"><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </AuthLayout>
  );
}
