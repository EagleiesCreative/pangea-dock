import type { Metadata } from "next";
import { GuestView } from "@/components/live/GuestView";

export const metadata: Metadata = { title: "Show agenda — Pangea Dock", robots: { index: false, follow: false } };

export default function SharePage({ params, searchParams }: { params: { token: string }; searchParams: { view?: string } }) {
  return <GuestView token={params.token} initialView={searchParams.view === "timer" ? "timer" : "agenda"} />;
}
