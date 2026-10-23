import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import type { Show } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Guest pass — no sign-in. Returns ONLY the agenda + live state + stage message.
 * Never: stream keys, gear, crew, cameras, patch, RF plan, comments, media links.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  const hdr = { "Cache-Control": "no-store", "X-Server-Now": String(Date.now()), "X-Robots-Tag": "noindex" };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: "Invalid link" }, { status: 404, headers: hdr });
  try {
    const meta = await store.findShare(token);
    if (!meta) return NextResponse.json({ error: "This link is no longer active" }, { status: 404, headers: hdr });
    const since = new URL(req.url).searchParams.get("since");
    if (since !== null && Number(since) >= meta.version) return new NextResponse(null, { status: 204, headers: hdr });
    const rec = await store.get(meta.orgId);
    const d = (rec.data ?? {}) as Partial<Show>;
    if (d.share?.token !== token) return NextResponse.json({ error: "This link is no longer active" }, { status: 404, headers: hdr });
    const showNotes = !!d.share?.showNotes;
    return NextResponse.json({
      version: rec.version,
      serverNow: Date.now(),
      event: { name: d.event?.name ?? "", venue: d.event?.venue ?? "", startTime: d.event?.startTime ?? "00:00:00" },
      cues: (d.cues ?? []).map((c) => ({ id: c.id, kind: c.kind ?? "cue", num: c.num, dur: c.dur, title: c.title, ...(showNotes ? { notes: c.notes } : {}) })),
      live: { on: !!d.live?.on, idx: d.live?.idx ?? 0, startedAt: d.live?.startedAt ?? null },
      stageMsg: d.stageMsg ?? null,
      showNotes,
    }, { headers: hdr });
  } catch (e) {
    console.error("[public]", e);
    return NextResponse.json({ error: "Unavailable" }, { status: 500, headers: hdr });
  }
}
