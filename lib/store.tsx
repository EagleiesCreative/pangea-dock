"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { seed } from "./seed";
import { isPlayable, nextPlayable, prevPlayable } from "./time";
import { canEditRole, isAdminRole } from "./roles";
import { closeLog, logTake, restartOpen } from "./perf";
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
  /** Server-aligned clock (ms). Use for all live timing so every device agrees. */
  serverNow: () => number;
  /** Pull from the server right away (e.g. after posting a comment). */
  refresh: () => void;
  clearPerfLog: () => void;
  sendStageMsg: (m: Show["stageMsg"]) => void;
  /** Production admin (can manage guest links). */
  isAdmin: boolean;
  /** JSON call to one of our API routes for the active production. Throws with the server's message on failure. */
  call: <T = any>(path: string, body?: unknown) => Promise<T>;
}

const Ctx = createContext<Api | null>(null);
export const useShow = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShow outside provider");
  return c;
};

const SECTIONS: Section[] = ["event", "cues", "cameras", "inputs", "outputs", "vault", "media", "speakers", "gear", "gearCats", "qc", "live", "perfLog", "stageMsg", "siteMap", "siteImage"];
/** Written only by dedicated server endpoints; the client just mirrors them. */
const READONLY: Section[] = ["comments", "share"];
const SAVE_DEBOUNCE = 450;
const LIVE_SAVE_DEBOUNCE = 60; // transport actions go out almost immediately
const POLL_MS = 2000;
const POLL_LIVE_MS = 1000; // faster while a show is running

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
    // Older shows have no section list: start from the defaults + any category already used by an item.
    gearCats: r.gearCats ?? [...new Set([...base.gearCats, ...(r.gear ?? []).map((g) => g.cat).filter(Boolean)])],
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
  const { user } = useUser();
  const nameRef = useRef<string | null>(null);
  nameRef.current = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || null;
  // Server clock offset (ms), estimated from response timestamps (half round-trip corrected, smoothed).
  const offset = useRef(0);
  const offsetSamples = useRef(0);
  const noteServerTime = (serverNow: unknown, t0: number, t1: number) => {
    if (typeof serverNow !== "number") return;
    const sample = serverNow - (t0 + t1) / 2;
    offset.current = offsetSamples.current === 0 ? sample : offset.current * 0.7 + sample * 0.3;
    offsetSamples.current++;
  };
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const liveRef = useRef(false);
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
      const t0 = Date.now();
      const res = await fetch("/api/show", { method: "PATCH", headers: hdrs({ "Content-Type": "application/json" }), body: JSON.stringify({ patch }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const j = await res.json();
      noteServerTime(j.serverNow, t0, Date.now());
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
      const t0 = Date.now();
      const res = await fetch(full ? "/api/show" : `/api/show?since=${version.current}`, { cache: "no-store", headers: hdrs() });
      const t1 = Date.now();
      const sn = Number(res.headers.get("x-server-now"));
      if (sn) noteServerTime(sn, t0, t1);
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
          READONLY.forEach((k) => { next[k] = remote[k]; });
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
    // Poll every second while the show is live (show-caller tracking), every 2 s otherwise.
    let last = 0;
    const t = setInterval(() => {
      const every = liveRef.current ? POLL_LIVE_MS : POLL_MS;
      if (document.hidden || inflight.current || Date.now() - last < every - 50) return;
      last = Date.now();
      pull(false);
    }, 250);
    const onVis = () => { if (!document.hidden) pull(false); };
    document.addEventListener("visibilitychange", onVis);
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current.size) { flush(); e.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("beforeunload", beforeUnload); if (timer.current) clearTimeout(timer.current); };
  }, [pull, flush]);

  liveRef.current = show.live.on;

  /* ---------- mutations ---------- */
  const mutate = useCallback((fn: (s: Show) => Show, fast = false) => {
    if (!canEditRef.current) return;
    setShowState((prev) => {
      const next = fn(prev);
      if (next !== prev) SECTIONS.forEach((k) => { if (next[k] !== prev[k]) dirty.current.add(k); });
      return next;
    });
    schedule(fast ? LIVE_SAVE_DEBOUNCE : SAVE_DEBOUNCE);
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
      mutate((s) => {
        const now = serverNow(), by = nameRef.current;
        if (!on) return { ...s, perfLog: closeLog(s.perfLog ?? [], now), live: { ...s.live, on: false, startedAt: null, by } };
        // Start on the current row if it can be taken, otherwise the next cue (skip section headers).
        let idx = Math.min(Math.max(s.live.idx, 0), Math.max(s.cues.length - 1, 0));
        if (!isPlayable(s.cues, idx)) { const n = nextPlayable(s.cues, idx); idx = n >= 0 ? n : idx; }
        return { ...s, perfLog: logTake(s, idx, now, by), live: { on: true, idx, startedAt: now, by } };
      }, true),
    go: () =>
      mutate((s) => {
        if (!s.live.on) return s;
        const now = serverNow(), by = nameRef.current;
        const n = nextPlayable(s.cues, s.live.idx);
        if (n < 0) return { ...s, perfLog: closeLog(s.perfLog ?? [], now), live: { on: false, idx: s.live.idx, startedAt: null, by } }; // end of show
        return { ...s, perfLog: logTake(s, n, now, by), live: { on: true, idx: n, startedAt: now, by } };
      }, true),
    prev: () =>
      mutate((s) => {
        const p = prevPlayable(s.cues, s.live.idx);
        if (p < 0) return s;
        const now = serverNow(), by = nameRef.current;
        return { ...s, perfLog: s.live.on ? logTake(s, p, now, by) : s.perfLog, live: { ...s.live, idx: p, startedAt: s.live.on ? now : null, by } };
      }, true),
    resetTimer: () =>
      mutate((s) => {
        const now = serverNow();
        return { ...s, perfLog: s.live.on ? restartOpen(s.perfLog ?? [], now) : s.perfLog, live: { ...s.live, startedAt: s.live.on ? now : null } };
      }, true),
    serverNow,
    refresh: () => { pull(false); },
    clearPerfLog: () => mutate((s) => ({ ...s, perfLog: [] })),
    sendStageMsg: (m) => mutate((s) => ({ ...s, stageMsg: m ? { ...m, at: serverNow(), by: nameRef.current } : null }), true),
    isAdmin: isAdminRole(role),
    call: async (path, body) => {
      const res = await fetch(path, body === undefined
        ? { cache: "no-store", headers: hdrs() }
        : { method: "POST", headers: hdrs({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (body !== undefined) pull(false); // pick up the server-side change right away
      return j;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [show, ready, canEdit, role, sync, mutate, serverNow, pull]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
