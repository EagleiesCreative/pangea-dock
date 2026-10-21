"use client";
import React, { useEffect, useRef, useState } from "react";
import { useClerk, useOrganization, useOrganizationList, useUser } from "@clerk/nextjs";
import { Check, ChevronsUpDown, LogOut, Plus, UserPlus, Users } from "lucide-react";
import { useShow } from "@/lib/store";
import { isAdminRole, roleLabel } from "@/lib/roles";
import { cx } from "./ui";
import { Avatar, CrewPanel } from "./workspace/CrewPanel";
import { NewProductionModal } from "./workspace/NewProduction";

/** Production switcher + crew + account menu — Pangea Dock's own UI (no Clerk cards). */
export function CrewControls({ compact }: { compact?: boolean }) {
  const { role } = useShow();
  const { organization } = useOrganization();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { userMemberships, setActive } = useOrganizationList({ userMemberships: { infinite: true } });
  const [open, setOpen] = useState(false);
  const [crew, setCrew] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminRole(role);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";
  const orgs = userMemberships?.data ?? [];

  return (
    <div className={cx("flex items-center gap-2", !compact && "w-full")}>
      <div ref={ref} className={cx("relative", !compact && "min-w-0 flex-1")}>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className={cx("flex items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-left transition hover:bg-raise", !compact && "w-full")}>
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-soft text-xs font-bold text-brand">
            {organization?.imageUrl && organization.hasImage
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={organization.imageUrl} alt="" className="h-full w-full object-cover" />
              : (organization?.name?.[0] ?? "P").toUpperCase()}
          </span>
          <span className={cx("min-w-0 flex-1", compact && "hidden sm:block max-w-[160px]")}>
            <span className="block truncate text-[13px] font-semibold text-fg">{organization?.name ?? "Production"}</span>
            <span className="block text-[11px] text-fg-muted">{roleLabel(role)}</span>
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-fg-muted" />
        </button>

        {open && (
          <div className={cx("absolute z-50 w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/10", compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2")}>
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-fg-muted">Productions</div>
            <div className="max-h-56 overflow-y-auto">
              {orgs.map((m) => {
                const on = m.organization.id === organization?.id;
                return (
                  <button key={m.id} onClick={async () => { if (!on) await setActive?.({ organization: m.organization.id }); setOpen(false); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-raise">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand">{m.organization.name[0]?.toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{m.organization.name}</span>
                      <span className="block text-[11px] text-fg-muted">{roleLabel(m.role)}</span>
                    </span>
                    {on && <Check size={15} className="text-brand" />}
                  </button>
                );
              })}
            </div>
            <Item icon={<Plus size={15} />} onClick={() => { setOpen(false); setCreating(true); }}>New production</Item>
            <div className="my-1.5 h-px bg-line" />
            <Item icon={isAdmin ? <UserPlus size={15} /> : <Users size={15} />} onClick={() => { setOpen(false); setCrew(true); }}>{isAdmin ? "Crew & invites" : "View crew"}</Item>
            <div className="my-1.5 h-px bg-line" />
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Avatar name={name} url={user?.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-fg">{name}</div>
                <div className="truncate text-[11px] text-fg-muted">{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
            </div>
            <Item icon={<LogOut size={15} />} danger onClick={() => signOut({ redirectUrl: "/sign-in" })}>Sign out</Item>
          </div>
        )}
      </div>

      {isAdmin && !compact && (
        <button className="btn !px-2.5" title="Invite crew" onClick={() => setCrew(true)}><UserPlus size={14} /></button>
      )}
      <CrewPanel open={crew} onClose={() => setCrew(false)} />
      <NewProductionModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Item({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-raise", danger ? "text-pgm" : "text-fg")}>
      <span className={danger ? "" : "text-fg-muted"}>{icon}</span>{children}
    </button>
  );
}
