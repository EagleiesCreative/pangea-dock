"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import {
  AuthLayout, Brand, CodeInput, Divider, ErrorText, Field, FootLink, GoogleButton, Input, Note, PasswordInput, Primary, TextButton, Title, clerkError, clerkErrorCode,
} from "./kit";

type SignUpResource = NonNullable<ReturnType<typeof useSignUp>["signUp"]>;

export function SignUpFlow() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const params = useSearchParams();
  const ticket = params.get("__clerk_ticket");
  const ticketStatus = params.get("__clerk_status"); // "sign_up" | "sign_in" | "complete"

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState<"" | "form" | "google">("");
  const [error, setError] = useState("");

  // Invitation for someone who already has an account → hand off to sign-in with the ticket.
  useEffect(() => {
    if (!ticket) return;
    if (ticketStatus === "sign_in") router.replace(`/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`);
    if (ticketStatus === "complete") router.replace("/");
  }, [ticket, ticketStatus, router]);

  const finish = async (res: SignUpResource) => {
    if (res.status === "complete" && setActive) {
      await setActive({ session: res.createdSessionId });
      router.replace("/");
      return;
    }
    if (res.unverifiedFields?.includes("email_address")) {
      await res.prepareEmailAddressVerification({ strategy: "email_code" });
      setCode(""); setVerifying(true);
      return;
    }
    const missing = res.missingFields?.join(", ");
    setError(missing ? `Your account still needs: ${missing}. Ask the admin to adjust Clerk sign-up settings, or continue with Google.` : `Sign-up incomplete (${res.status}).`);
  };

  const run = async (fn: () => Promise<unknown>, which: "form" | "google" = "form") => {
    if (!isLoaded) return;
    setBusy(which); setError("");
    try { await fn(); } catch (e) { setError(clerkError(e)); } finally { setBusy(""); }
  };

  const google = () =>
    run(() => signUp!.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/" }), "google");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const names = name.trim() ? { firstName, lastName: rest.join(" ") || undefined } : {};
    const base = ticket ? { strategy: "ticket" as const, ticket, password } : { emailAddress: email.trim(), password };
    run(async () => {
      try {
        await finish(await signUp!.create({ ...base, ...names }));
      } catch (err) {
        // Instance doesn't collect names → retry without them.
        if (clerkErrorCode(err) === "form_param_unknown" && Object.keys(names).length) await finish(await signUp!.create(base));
        else throw err;
      }
    });
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => { await finish(await signUp!.attemptEmailAddressVerification({ code })); });
  };

  return (
    <AuthLayout>
      <Brand />
      {!verifying ? (
        <>
          <Title
            title={ticket ? "You're invited" : "Create your account"}
            sub={ticket ? "Set up your account to join the production." : "Plan, patch and call the show with your crew."}
          />
          {!ticket && (
            <>
              <GoogleButton onClick={google} loading={busy === "google"} label="Sign up with Google" />
              <Divider />
            </>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name">
              <Input autoComplete="name" placeholder="Rina Wijaya" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {!ticket && (
              <Field label="Email">
                <Input type="email" autoComplete="email" required placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            )}
            <Field label="Password">
              <PasswordInput autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {/* Clerk bot protection renders its challenge here when needed */}
            <div id="clerk-captcha" />
            <ErrorText>{error}</ErrorText>
            <Primary type="submit" loading={busy === "form"}>{ticket ? "Join production" : "Create account"}</Primary>
          </form>
          <FootLink text="Already have an account?" href="/sign-in" cta="Sign in" />
        </>
      ) : (
        <>
          <button type="button" onClick={() => { setVerifying(false); setError(""); }} className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"><ArrowLeft size={15} /> Back</button>
          <Title title="Verify your email" sub={<>Enter the code we sent to <b className="font-semibold text-fg">{email}</b>.</>} />
          <form onSubmit={verify} className="space-y-4">
            <CodeInput value={code} onChange={setCode} />
            <ErrorText>{error}</ErrorText>
            <Primary type="submit" loading={busy === "form"} disabled={code.length < 6}>Verify & continue</Primary>
          </form>
          <div className="mt-4 text-center">
            <TextButton onClick={() => run(() => signUp!.prepareEmailAddressVerification({ strategy: "email_code" }))}>Resend code</TextButton>
          </div>
          <div className="mt-6"><Note>Didn't get it? Check spam, or make sure the address is right.</Note></div>
        </>
      )}
    </AuthLayout>
  );
}
