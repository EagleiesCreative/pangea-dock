"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";

/** Back + full-screen buttons that fade out when the mouse is idle; also keeps the screen awake. */
export function TimerChrome({ back = "/" }: { back?: string | null }) {
  const [fs, setFs] = useState(false);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    // Hide the controls after a few seconds without the mouse moving.
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2500); };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    // Keep the screen awake where supported.
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { document.removeEventListener("fullscreenchange", onFs); window.removeEventListener("mousemove", wake); window.removeEventListener("touchstart", wake); clearTimeout(t); lock?.release().catch(() => {}); };
  }, []);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return (
    <div className={`fixed bottom-4 right-4 flex gap-2 transition-opacity duration-500 ${idle ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      {back && <Link href={back} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur hover:bg-white/20"><ArrowLeft size={14} /> Back</Link>}
      <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur hover:bg-white/20">
        {fs ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{fs ? "Exit full screen" : "Full screen"}
      </button>
    </div>
  );
}

