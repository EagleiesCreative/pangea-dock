"use client";
import React, { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Loader2, Mail, Trash2, UserPlus, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Badge, cx } from "@/components/ui";
import { isAdminRole, roleLabel } from "@/lib/roles";
import { clerkError } from "@/components/auth/kit";

type RoleOpt = { key: string; name: string };
const FALLBACK_ROLES: RoleOpt[] = [
  { key: "org:admin", name: "Admin" },
  { key: "org:member", name: "Editor" },
  { key: "org:viewer", name: "Viewer" },
];
const roleName = (key: string, opts: RoleOpt[]) => (key === "org:member" ? "Editor" : opts.find((r) => r.key === key)?.name ?? roleLabel(key));

export function CrewPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { organization, membership, memberships, invitations, isLoaded } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true },
    invitations: { infinite: true, status: ["pending"], keepPreviousData: true },
  });
  const isAdmin = isAdminRole(membership?.role);
  const [roles, setRoles] = useState<RoleOpt[]>(FALLBACK_ROLES);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("org:member");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open || !organization) return;
    organization.getRoles().then((r) => {
      const list = r.data.map((x) => ({ key: x.key, name: x.name }));
      if (list.length) setRoles(list);
    }).catch(() => {});
  }, [open, organization]);

  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id); setMsg(null);
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); }
    catch (e) { setMsg({ ok: false, text: clerkError(e) }); }
    finally { setBusy(""); }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const list = [...new Set(emails.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
    if (!list.length || !organization) return;
    run("invite", async () => {
      for (const emailAddress of list) await organization.inviteMember({ emailAddress, role });
      setEmails("");
      await invitations?.revalidate?.();
    }, `Invitation${list.length > 1 ? "s" : ""} sent to ${list.join(", ")}.`);
  };

  const members = memberships?.data ?? [];
  const pending = invitations?.data ?? [];

  return (
    <Modal open={open} onClose={onClose} wide title="Crew & invites" sub={organization ? `${organization.name} · ${members.length} member${members.length === 1 ? "" : "s"}` : undefined}>
      {!isLoaded ? <div className="grid place-items-center py-10 text-fg-muted"><Loader2 className="animate-spin" /></div> : (
        <div className="space-y-6">
          {isAdmin ? (
            <form onSubmit={invite} className="space-y-2.5">
              <div className="label">Invite crew by email</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="h-11 flex-1 rounded-xl border border-line bg-raise px-3.5 text-sm text-fg outline-none placeholder:text-fg-faint focus:border-brand/50 focus:bg-surface focus:ring-4 focus:ring-brand/10"
                  placeholder="name@studio.com, another@studio.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
                <select value={role} onChange={(e) => setRole(e.target.value)} className="h-11 rounded-xl border border-line bg-raise px-3 text-sm text-fg outline-none focus:border-brand/50">
                  {roles.map((r) => <option key={r.key} value={r.key}>{roleName(r.key, roles)}</option>)}
                </select>
                <button type="submit" disabled={busy === "invite" || !emails.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-inverse px-4 text-sm font-semibold text-on-inverse transition hover:opacity-90 disabled:opacity-40">
                  {busy === "invite" ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Invite
                </button>
              </div>
              <p className="text-xs text-fg-muted">Editors can change the show. Viewers can only watch. Separate several emails with commas.</p>
            </form>
          ) : (
            <p className="rounded-xl bg-raise px-3.5 py-2.5 text-[13px] text-fg-muted">Only admins can invite people or change roles.</p>
          )}

          {msg && <p role="status" className={cx("rounded-xl px-3.5 py-2.5 text-[13px]", msg.ok ? "bg-pvw/10 text-pvw" : "bg-pgm/10 text-pgm")}>{msg.text}</p>}

          {pending.length > 0 && (
            <section>
              <div className="label mb-2">Pending invitations</div>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {pending.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-raise text-fg-muted"><Mail size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-fg">{inv.emailAddress}</div>
                      <div className="text-xs text-fg-muted">{roleName(inv.role, roles)} · waiting to join</div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => run(inv.id, async () => { await inv.revoke(); await invitations?.revalidate?.(); })} disabled={busy === inv.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-raise hover:text-pgm"><X size={13} /> Revoke</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="label mb-2">Members</div>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {members.map((m) => {
                const name = [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || m.publicUserData?.identifier || "Member";
                const me = m.id === membership?.id;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <Avatar name={name} url={m.publicUserData?.imageUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-medium text-fg">{name}{me && <Badge tone="gray">You</Badge>}</div>
                      <div className="truncate text-xs text-fg-muted">{m.publicUserData?.identifier}</div>
                    </div>
                    {isAdmin && !me ? (
                      <>
                        <select value={m.role} disabled={busy === m.id} onChange={(e) => run(m.id, async () => { await m.update({ role: e.target.value }); await memberships?.revalidate?.(); })}
                          className="h-9 rounded-lg border border-line bg-raise px-2 text-xs text-fg outline-none focus:border-brand/50">
                          {[...(roles.some((r) => r.key === m.role) ? roles : [...roles, { key: m.role, name: roleLabel(m.role) }])].map((r) => <option key={r.key} value={r.key}>{roleName(r.key, roles)}</option>)}
                        </select>
                        <button title="Remove from production" disabled={busy === m.id}
                          onClick={() => window.confirm(`Remove ${name} from this production?`) && run(m.id, async () => { await m.destroy(); await memberships?.revalidate?.(); })}
                          className="rounded-lg p-2 text-fg-faint transition hover:bg-raise hover:text-pgm"><Trash2 size={15} /></button>
                      </>
                    ) : <Badge tone={isAdminRole(m.role) ? "violet" : m.role === "org:member" ? "green" : "gray"}>{roleName(m.role, roles)}</Badge>}
                  </li>
                );
              })}
            </ul>
            {memberships?.hasNextPage && <button className="btn mt-3" onClick={() => memberships.fetchNext?.()}>Load more</button>}
          </section>
        </div>
      )}
    </Modal>
  );
}

export function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full bg-raise object-cover" style={{ width: size, height: size }} />;
  return <span className="grid shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand" style={{ width: size, height: size }}>{initials}</span>;
}
