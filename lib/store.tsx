"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { seed } from "./seed";
import { canEditRole } from "./roles";
import type { ListKey, Show } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 9);

type Rec = { id: string };
type Section = keyof Show;
export type SyncState = "loading" | "synced" | "saving" | "offline" | "error";

interface Api {
  show: Show;
  ready: boolean;
  canEdit: boolean;
  role: string | null;
  sync: { state: SyncState; updatedBy: string | null; updatedAt: string | null; error?: string };
  setShow: (fn: (s: Show) => Show) => void;
  patchEvent: (p: Partial<Show["event"]>) => void;
  patchVault: (p: Partial<Show["vault"]>) => void;
  patch: (k: ListKey, id: string, p: Record<string, unknown>) => void;
  add: (k: ListKey, item: Rec, afterId?: string) => void;
  remove: (k: ListKey, id: string) => void;
  move: (k: ListKey, id: string, dir: -1 | 1) => void;
  dup: (k: ListKey, id: string) => void;
  replaceAll: (s: Show) => void;
  reset: () => void;
  setLive: (on: boolean) => void;
  go: () => void;
  prev: () => void;
  resetTimer: () => void;
}

const Ctx = createContext<Api | null>(null);
export const useShow = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShow outside provider");
  return c;
};

const SECTIONS: Section[] = ["event", "cues", "cameras", "inputs", "outputs", "vault", "media", "speakers", "gear", "qc", "live", "siteMap", "siteImage"];
const SAVE_DEBOUNCE = 450;
const POLL_MS = 2000;

function migrate(raw: unknown): Show {
  const base = seed();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Show>;
  return {
    ...base,
    ...r,
    event: { ...base.event, ...(r.event ?? {}) },
    vault: { ...base.vault, ...(r.vault ?? {}) },
    live: { ...base.live, ...(r.live ?? {}) },
    siteMap: r.siteMap ? { ...base.siteMap, ...r.siteMap, geo: { ...base.siteMap.geo, ...(r.siteMap.geo ?? {}) } } : base.siteMap,
    siteImage: r.siteImage ?? base.siteImage,
  };
}

/**
 * Server-backed show state for the active production (Clerk org).
 * - Edits apply locally at once; the changed top-level sections are queued and PATCHed (debounced).
 * - Every POLL_MS we ask for a newer version; remote sections are applied except ones with unsaved local edits.
 */
export function ShowProvider({ children, clientRole = null }: { children: React.ReactNode; clientRole?: string | null }) {
  const [show, setShowState] = useState<Show>(() => seed());
  const [ready, setReady] = useState(false);
  const { orgId } = useAuth();
  const orgRef = useRef(orgId);
  orgRef.current = orgId;
  const hdrs = (extra?: Record<string, string>) => ({ ...(orgRef.current ? { "X-Org-Id": orgRef.current } : {}), ...extra });
  const [serverRole, setRole] = useState<string | null>(null);
  // Clerk's client-side role is known instantly; the server's answer wins once it arrives (and the API enforces it anyway).
  const role = serverRole ?? clientRole;
  const gotFull = useRef(false); // until one full GET succeeds, keep polling the full document (not ?since=)
  const [sync, setSync] = useState<Api["sync"]>({ state: "loading", updatedBy: null, updatedAt: null });

  const showRef = useRef(show);
  showRef.current = show;
  const version = useRef(0);
  const dirty = useRef<Set<Section>>(new Set());
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = canEditRole(role);
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  /* ---------- save ---------- */
  const flush = useCallback(async () => {
    if (inflight.current || !dirty.current.size || !canEditRef.current) return;
    inflight.current = true;
    const keys = [...dirty.current];
    const snap = showRef.current;
    const patch: Partial<Show> = {};
    keys.forEach((k) => ((patch as Record<string, unknown>)[k] = snap[k]));
    setSync((s) => ({ ...s, state: "saving" }));
    try {
      const res = await fetch("/api/show", { method: "PATCH", headers: hdrs({ "Content-Type": "application/json" }), body: JSON.stringify({ patch }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const j = await res.json();
      version.current = j.version;
      // Only clear sections that weren't edited again while the request was in flight.
      keys.forEach((k) => { if (showRef.current[k] === snap[k]) dirty.current.delete(k); });
      setSync({ state: dirty.current.size ? "saving" : "synced", updatedBy: j.updatedBy, updatedAt: j.updatedAt });
    } catch (e) {
      setSync((s) => ({ ...s, state: navigator.onLine ? "error" : "offline", error: e instanceof Error ? e.message : String(e) }));
    } finally {
      inflight.current = false;
      if (dirty.current.size) schedule(1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useCallback((ms = SAVE_DEBOUNCE) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, ms);
  }, [flush]);

  /* ---------- load + poll ---------- */
  const pull = useCallback(async (initial = false) => {
    try {
      const full = initial || !gotFull.current;
      const res = await fetch(full ? "/api/show" : `/api/show?since=${version.current}`, { cache: "no-store", headers: hdrs() });
      if (res.status === 204) {
        setSync((s) => (s.state === "offline" || s.state === "error" ? { ...s, state: dirty.current.size ? "saving" : "synced" } : s));
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const j = await res.json();
      setRole(j.role ?? null);
      const firstFull = !gotFull.current;
      gotFull.current = true;
      if (firstFull && !j.data && canEditRole(j.role)) {
        // Brand-new production: seed it with the demo dataset so it's usable immediately.
        SECTIONS.forEach((k) => dirty.current.add(k));
        setShowState(seed());
        schedule(0);
      } else if (j.data) {
        const remote = migrate(j.data);
        setShowState((prev) => {
          if (firstFull) return remote;
          const next = { ...prev } as Record<Section, unknown>;
          SECTIONS.forEach((k) => { if (!dirty.current.has(k)) next[k] = remote[k]; });
          return next as unknown as Show;
        });
      }
      version.current = j.version;
      setSync((s) => ({ state: dirty.current.size ? "saving" : "synced", updatedBy: j.updatedBy ?? s.updatedBy, updatedAt: j.updatedAt ?? s.updatedAt }));
    } catch (e) {
      setSync((s) => ({ ...s, state: navigator.onLine ? "error" : "offline", error: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (initial) setReady(true);
    }
  }, [schedule]);

  useEffect(() => {
    pull(true);
    const t = setInterval(() => { if (!document.hidden && !inflight.current) pull(false); }, POLL_MS);
    const onVis = () => { if (!document.hidden) pull(false); };
    document.addEventListener("visibilitychange", onVis);
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current.size) { flush(); e.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("beforeunload", beforeUnload); if (timer.current) clearTimeout(timer.current); };
  }, [pull, flush]);

  /* ---------- mutations ---------- */
  const mutate = useCallback((fn: (s: Show) => Show) => {
    if (!canEditRef.current) return;
    setShowState((prev) => {
      const next = fn(prev);
      if (next !== prev) SECTIONS.forEach((k) => { if (next[k] !== prev[k]) dirty.current.add(k); });
      return next;
    });
    schedule();
  }, [schedule]);

  const mapList = (k: ListKey, fn: (l: any[]) => any[]) => mutate((s) => ({ ...s, [k]: fn(s[k] as any[]) }));

  const api = useMemo<Api>(() => ({
    show, ready, canEdit, role, sync,
    setShow: mutate,
    patchEvent: (p) => mutate((s) => ({ ...s, event: { ...s.event, ...p } })),
    patchVault: (p) => mutate((s) => ({ ...s, vault: { ...s.vault, ...p } })),
    patch: (k, id, p) => mapList(k, (l) => l.map((x) => (x.id === id ? { ...x, ...p } : x))),
    add: (k, item, afterId) =>
      mapList(k, (l) => {
        if (!afterId) return [...l, item];
        const i = l.findIndex((x) => x.id === afterId);
        const c = [...l];
        c.splice(i < 0 ? c.length : i + 1, 0, item);
        return c;
      }),
    remove: (k, id) => mapList(k, (l) => l.filter((x) => x.id !== id)),
    move: (k, id, dir) =>
      mapList(k, (l) => {
        const i = l.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= l.length) return l;
        const c = [...l];
        [c[i], c[j]] = [c[j], c[i]];
        return c;
      }),
    dup: (k, id) =>
      mapList(k, (l) => {
        const i = l.findIndex((x) => x.id === id);
        if (i < 0) return l;
        const c = [...l];
        c.splice(i + 1, 0, { ...l[i], id: uid() });
        return c;
      }),
    replaceAll: (s) => mutate(() => migrate(s)),
    reset: () => mutate(() => seed()),
    setLive: (on) =>
      mutate((s) => ({
        ...s,
        live: on
          ? { on: true, idx: Math.min(Math.max(s.live.idx, 0), Math.max(s.cues.length - 1, 0)), startedAt: Date.now() }
          : { ...s.live, on: false, startedAt: null },
      })),
    go: () =>
      mutate((s) => {
        if (!s.live.on) return s;
        if (s.live.idx >= s.cues.length - 1) return { ...s, live: { on: false, idx: s.live.idx, startedAt: null } };
        return { ...s, live: { on: true, idx: s.live.idx + 1, startedAt: Date.now() } };
      }),
    prev: () => mutate((s) => ({ ...s, live: { ...s.live, idx: Math.max(0, s.live.idx - 1), startedAt: s.live.on ? Date.now() : null } })),
    resetTimer: () => mutate((s) => ({ ...s, live: { ...s.live, startedAt: s.live.on ? Date.now() : null } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [show, ready, canEdit, role, sync, mutate]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
