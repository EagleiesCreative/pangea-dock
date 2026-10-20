"use client";
import React from "react";
import { UserPlus } from "lucide-react";
import { OrganizationSwitcher, UserButton, useClerk } from "@clerk/nextjs";
import { useShow } from "@/lib/store";
import { cx } from "./ui";

export function CrewControls({ compact }: { compact?: boolean }) {
  const { role } = useShow();
  const clerk = useClerk();
  const isAdmin = role === "org:admin";
  return (
    <div className={cx("flex items-center gap-2", !compact && "w-full")}>
      <div className={cx("min-w-0", !compact && "flex-1")}>
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" afterLeaveOrganizationUrl="/" />
      </div>
      {isAdmin && (
        <button className="btn !px-2.5" title="Invite crew" onClick={() => clerk.openOrganizationProfile()}>
          <UserPlus size={14} />{!compact && <span className="hidden xl:inline">Invite</span>}
        </button>
      )}
      <UserButton />
    </div>
  );
}

