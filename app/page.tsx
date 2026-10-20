"use client";
import React, { useEffect, useState } from "react";
import { ClipboardCheck, ListOrdered, Network, Package, Clapperboard, Radio, Eye } from "lucide-react";
import { OrganizationList, useAuth } from "@clerk/nextjs";
import { CrewControls } from "@/components/Crew";
import { AuthShell } from "@/components/AuthShell";
import { roleLabel } from "@/lib/roles";
import { ShowProvider, useShow } from "@/lib/store";
import { Header } from "@/components/Header";
import { Ros } from "@/components/Ros";
import { CameraMatrix } from "@/components/CameraMatrix";
import { Media } from "@/components/Media";
import { Gear } from "@/components/Gear";
import { Qc } from "@/components/Qc";
import { PrintBook } from "@/components/PrintBook";
import { Badge, Progress, cx } from "@/components/ui";

const TABS = [
  { id: "ros", label: "Run-of-Show", icon: ListOrdered, el: Ros },
  { id: "plot", label: "Camera Plot & Patch", icon: Network, el: CameraMatrix },
  { id: "media", label: "Media & CG", icon: Clapperboard, el: Media },
  { id: "gear", label: "Gear Inventory", icon: Package, el: Gear },
  { id: "qc", label: "Pre-Flight QC", icon: ClipboardCheck, el: Qc },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Sidebar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  const { show, role } = useShow();
  const qcDone = show.qc.filter((q) => q.done).length;
  const qcPct = show.qc.length ? Math.round((qcDone / show.qc.length) * 100) : 0;
  const loaded = show.gear.filter((g) => g.loaded).length;
  const gearPct = show.gear.length ? Math.round((loaded / show.gear.length) * 100) : 0;
  const locked = show.inputs.filter((i) => i.status === "Locked").length;
  const counts: Partial<Record<TabId, number>> = { ros: show.cues.length, media: show.media.length, gear: show.gear.length };

  return (
    <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface/70 px-4 py-5 backdrop-blur-xl lg:flex">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-inverse text-on-inverse"><Radio size={16} /></span>
        <div>
          <div className="text-[15px] font-semibold leading-tight text-fg">Pangea Dock</div>
          <div className="text-[11px] text-fg-muted">TD Command Center</div>
        </div>
      </div>

      <nav className="space-y-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={on ? "page" : undefined}
              className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition", on ? "bg-brand-soft font-medium text-brand" : "text-fg-soft hover:bg-raise hover:text-fg")}>
              <Icon size={17} strokeWidth={on ? 2.2 : 1.8} />
              <span className="flex-1 text-left">{t.label}</span>
              {counts[t.id] !== undefined && <span className={cx("text-[11px] tabular-nums", on ? "text-brand/70" : "text-fg-faint")}>{counts[t.id]}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 rounded-2xl bg-brand-soft p-4">
        <div className="text-[13px] font-semibold text-fg">Show readiness</div>
        <Stat label="Pre-flight QC" value={`${qcPct}%`} pct={qcPct} color={qcPct === 100 ? "bg-pvw" : "bg-brand"} />
        <Stat label="Gear loaded in" value={`${loaded}/${show.gear.length}`} pct={gearPct} color="bg-brand" />
        <Stat label="Inputs locked" value={`${locked}/${show.inputs.length}`} pct={show.inputs.length ? (locked / show.inputs.length) * 100 : 0} color="bg-brand" />
        <button className="btn w-full justify-center !bg-surface" onClick={() => setTab("qc")}>Open checklist</button>
      </div>

      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <div className="flex items-center justify-between px-1 text-[11.5px] text-fg-muted">
          <span>Production</span>
          <Badge tone={role === "org:admin" ? "violet" : roleLabel(role) === "Editor" ? "green" : "gray"}>{roleLabel(role)}</Badge>
        </div>
        <CrewControls />
      </div>
    </aside>
  );
}

function Stat({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-fg-muted">{label}</span><span className="font-medium tabular-nums text-fg">{value}</span></div>
      <Progress pct={pct} color={color} />
    </div>
  );
}

function App() {
  const { ready, show, go, canEdit } = useShow();
  const [tab, setTab] = useState<TabId>("ros");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    try { const t = localStorage.getItem("pangeadock.tab"); if (t && TABS.some((x) => x.id === t)) setTab(t as TabId); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("pangeadock.tab", tab); } catch {} }, [tab]);

  // Spacebar = GO while Live Show Mode is active and nothing editable has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (!show.live.on || !canEdit || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      go();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show.live.on, canEdit, go]);

  if (!ready) return <div className="grid min-h-screen place-items-center text-xs font-medium text-fg-muted">Loading Pangea Dock…</div>;
  const Active = TABS.find((t) => t.id === tab)!.el;

  return (
    <>
      <div className="no-print flex min-h-screen">
        <Sidebar tab={tab} setTab={setTab} />
        <div className="min-w-0 flex-1">
          <Header onPrint={() => setPrinting(true)} />
          {/* Compact pill tabs below lg */}
          <nav className="flex gap-1.5 overflow-x-auto px-4 pt-4 lg:hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = t.id === tab;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={on ? "page" : undefined}
                  className={cx("flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition", on ? "bg-inverse text-on-inverse" : "border border-line bg-surface text-fg-soft")}>
                  <Icon size={14} />{t.label}
                </button>
              );
            })}
          </nav>
          <main className="mx-auto max-w-[1600px] p-4 lg:p-6">
            {!canEdit && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-fg-muted">
                <Eye size={14} /> You have view-only access to this production. Changes by editors appear live.
              </div>
            )}
            {/* A disabled fieldset makes every control inside read-only for viewers. */}
            <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
              <Active />
            </fieldset>
          </main>
        </div>
      </div>
      {printing && <PrintBook onClose={() => setPrinting(false)} />}
    </>
  );
}

export default function Page() {
  const { isLoaded, orgId } = useAuth();
  if (!isLoaded) return <div className="grid min-h-screen place-items-center text-xs font-medium text-fg-muted">Loading Pangea Dock…</div>;
  if (!orgId)
    return (
      <AuthShell title="Choose a production" sub="Each production has its own run-of-show, crew and permissions. Create one, or open one you've been invited to.">
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
      </AuthShell>
    );
  // key= remounts the store when switching productions
  return <ShowProvider key={orgId}><App /></ShowProvider>;
}
