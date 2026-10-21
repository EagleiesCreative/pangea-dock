"use client";
import React, { useState } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorText, Field, Input, Primary, clerkError } from "@/components/auth/kit";

export function NewProductionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createOrganization, setActive, isLoaded } = useOrganizationList();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrganization || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const org = await createOrganization({ name: name.trim() });
      await setActive?.({ organization: org.id });
      setName(""); onClose();
    } catch (err) { setError(clerkError(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New production" sub="Each production has its own run-of-show, crew and permissions.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Production name">
          <Input autoFocus placeholder="e.g. Grand Keynote 2026" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Primary type="submit" loading={busy} disabled={!isLoaded || !name.trim()}>{busy ? <Loader2 size={15} className="animate-spin" /> : null}Create production</Primary>
      </form>
    </Modal>
  );
}
