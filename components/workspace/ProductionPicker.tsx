"use client";
import React, { useState } from "react";
import { useClerk, useOrganizationList, useUser } from "@clerk/nextjs";
import { ArrowRight, Loader2, LogOut, Mail, Plus } from "lucide-react";
import { AuthLayout, Brand, ErrorText, Field, Input, Primary, Title, clerkError } from "@/components/auth/kit";
import { roleLabel } from "@/lib/roles";

/** Shown when signed in but no production is active yet. */
export function ProductionPicker() {
  const { isLoaded, setActive, createOrganization, userMemberships, userInvitations } = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: { infinite: true, status: "pending" } as never,
  });
  const { user } = useUser();
  const { signOut } = useClerk();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  const memberships = userMemberships?.data ?? [];
  const invites = userInvitations?.data ?? [];
  const noneYet = isLoaded && !memberships.length && !invites.length;

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id); setError("");
    try { await fn(); } catch (e) { setError(clerkError(e)); setBusy(""); }
  };

  return (
    <AuthLayout>
      <Brand />
      <Title title="Choose a production" sub={`Signed in as ${user?.primaryEmailAddress?.emailAddress ?? "…"}`} />
      {!isLoaded ? <div className="flex justify-center py-8 text-fg-muted"><Loader2 className="animate-spin" /></div> : (
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
                  <button disabled={!!busy} onClick={() => run(inv.id, async () => { const r = await inv.accept(); await setActive?.({ organization: r.publicOrganizationData.id }); })}
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
                <button key={m.id} disabled={!!busy} onClick={() => run(m.id, () => setActive!({ organization: m.organization.id }))}
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
            <form className="space-y-3 rounded-xl border border-line p-3.5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run("new", async () => { const o = await createOrganization!({ name: name.trim() }); await setActive?.({ organization: o.id }); }); }}>
              <Field label="New production name"><Input placeholder="e.g. Grand Keynote 2026" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Primary type="submit" loading={busy === "new"} disabled={!name.trim()}>Create production</Primary>
            </form>
          )}

          <ErrorText>{error}</ErrorText>
          <button onClick={() => signOut({ redirectUrl: "/sign-in" })} className="mx-auto flex items-center gap-1.5 pt-2 text-[13px] font-medium text-fg-muted hover:text-fg"><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </AuthLayout>
  );
}
