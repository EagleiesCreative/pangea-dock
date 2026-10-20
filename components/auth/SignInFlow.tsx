"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  AuthLayout, Brand, CodeInput, Divider, ErrorText, Field, FootLink, GoogleButton, Input, Note, PasswordInput, Primary, TextButton, Title, clerkError,
} from "./kit";

type SignInResource = NonNullable<ReturnType<typeof useSignIn>["signIn"]>;
type EmailCodeFactor = { strategy: "email_code"; emailAddressId: string };

type Step =
  | { k: "password" }
  | { k: "code"; email: string }          // first factor: email code
  | { k: "second"; strategy: "email_code" | "totp" | "phone_code" | "backup_code" }
  | { k: "forgot"; sent: boolean }
  | { k: "ticket" };

export function SignInFlow() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect_url") || "/";
  const ticket = params.get("__clerk_ticket");

  const [step, setStep] = useState<Step>(ticket ? { k: "ticket" } : { k: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState<"" | "form" | "google">("");
  const [error, setError] = useState("");
  const ticketTried = useRef(false);

  const go = async (res: SignInResource) => {
    if (res.status === "complete" && setActive) {
      await setActive({ session: res.createdSessionId });
      router.replace(redirect.startsWith("/") ? redirect : "/");
      return true;
    }
    if (res.status === "needs_second_factor") {
      const f = res.supportedSecondFactors ?? [];
      const emailF = f.find((x) => x.strategy === "email_code") as unknown as EmailCodeFactor | undefined;
      if (f.some((x) => x.strategy === "totp")) setStep({ k: "second", strategy: "totp" });
      else if (emailF) { await res.prepareSecondFactor({ strategy: "email_code", emailAddressId: emailF.emailAddressId }); setStep({ k: "second", strategy: "email_code" }); }
      else if (f.some((x) => x.strategy === "phone_code")) { await res.prepareSecondFactor({ strategy: "phone_code" }); setStep({ k: "second", strategy: "phone_code" }); }
      else setStep({ k: "second", strategy: "backup_code" });
      setCode("");
      return true;
    }
    setError(`Sign-in needs another step (${res.status}). Try "Email me a code" instead.`);
    return false;
  };

  const run = async (fn: () => Promise<unknown>, which: "form" | "google" = "form") => {
    if (!isLoaded) return;
    setBusy(which); setError("");
    try { await fn(); } catch (e) { setError(clerkError(e)); } finally { setBusy(""); }
  };

  // Organization invitations land here with a ticket for existing users.
  useEffect(() => {
    if (!isLoaded || !ticket || ticketTried.current) return;
    ticketTried.current = true;
    run(async () => { await go(await signIn!.create({ strategy: "ticket", ticket })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, ticket]);

  const google = () =>
    run(() => signIn!.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: redirect }), "google");

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => { await go(await signIn!.create({ identifier: email.trim(), password })); });
  };

  const sendEmailCode = () =>
    run(async () => {
      if (!email.trim()) throw new Error("Enter your email address first.");
      const res = await signIn!.create({ identifier: email.trim() });
      const f = res.supportedFirstFactors?.find((x) => x.strategy === "email_code") as unknown as EmailCodeFactor | undefined;
      if (!f) throw new Error("Email codes aren't enabled for this account. Use your password or Google.");
      await res.prepareFirstFactor({ strategy: "email_code", emailAddressId: f.emailAddressId });
      setCode(""); setStep({ k: "code", email: email.trim() });
    });

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => { await go(await signIn!.attemptFirstFactor({ strategy: "email_code", code })); });
  };

  const submitSecond = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.k !== "second") return;
    run(async () => { await go(await signIn!.attemptSecondFactor({ strategy: step.strategy, code })); });
  };

  const sendReset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await signIn!.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setCode(""); setStep({ k: "forgot", sent: true });
    });
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => { await go(await signIn!.attemptFirstFactor({ strategy: "reset_password_email_code", code, password: newPassword })); });
  };

  const back = () => { setError(""); setCode(""); setStep({ k: "password" }); };
  const BackLink = () => (
    <button type="button" onClick={back} className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"><ArrowLeft size={15} /> Back</button>
  );

  return (
    <AuthLayout>
      <Brand />

      {step.k === "ticket" && (
        <>
          <Title title="Joining production" sub="Accepting your invitation…" />
          {busy ? <div className="flex justify-center py-6 text-fg-muted"><Loader2 className="animate-spin" /></div> : <ErrorText>{error}</ErrorText>}
          {error && <div className="mt-4"><Primary onClick={back}>Sign in normally</Primary></div>}
        </>
      )}

      {step.k === "password" && (
        <>
          <Title title="Welcome back" sub="Sign in to run the show with your crew." />
          <GoogleButton onClick={google} loading={busy === "google"} />
          <Divider />
          <form onSubmit={submitPassword} className="space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="email" required placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" hint={<TextButton onClick={() => { setError(""); setStep({ k: "forgot", sent: false }); }}>Forgot password?</TextButton>}>
              <PasswordInput autoComplete="current-password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Primary type="submit" loading={busy === "form"}>Sign in</Primary>
          </form>
          <div className="mt-4 text-center"><TextButton onClick={sendEmailCode}>Email me a sign-in code instead</TextButton></div>
          <FootLink text="Don't have an account?" href="/sign-up" cta="Sign up" />
        </>
      )}

      {step.k === "code" && (
        <>
          <BackLink />
          <Title title="Check your email" sub={<>We sent a sign-in code to <b className="font-semibold text-fg">{step.email}</b>.</>} />
          <form onSubmit={submitCode} className="space-y-4">
            <CodeInput value={code} onChange={setCode} />
            <ErrorText>{error}</ErrorText>
            <Primary type="submit" loading={busy === "form"} disabled={code.length < 6}>Verify & sign in</Primary>
          </form>
          <div className="mt-4 text-center"><TextButton onClick={sendEmailCode}>Resend code</TextButton></div>
        </>
      )}

      {step.k === "second" && (
        <>
          <BackLink />
          <Title
            title="Two-step verification"
            sub={step.strategy === "totp" ? "Enter the code from your authenticator app." : step.strategy === "backup_code" ? "Enter one of your backup codes." : `Enter the code we sent to your ${step.strategy === "phone_code" ? "phone" : "email"}.`}
          />
          <form onSubmit={submitSecond} className="space-y-4">
            {step.strategy === "backup_code"
              ? <Input autoFocus placeholder="Backup code" value={code} onChange={(e) => setCode(e.target.value.trim())} />
              : <CodeInput value={code} onChange={setCode} />}
            <ErrorText>{error}</ErrorText>
            <Primary type="submit" loading={busy === "form"} disabled={code.length < 6}>Verify</Primary>
          </form>
        </>
      )}

      {step.k === "forgot" && (
        <>
          <BackLink />
          <Title title="Reset password" sub={step.sent ? <>Enter the code sent to <b className="font-semibold text-fg">{email}</b> and choose a new password.</> : "We'll email you a code to reset it."} />
          {!step.sent ? (
            <form onSubmit={sendReset} className="space-y-4">
              <Field label="Email">
                <Input type="email" autoComplete="email" required placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <ErrorText>{error}</ErrorText>
              <Primary type="submit" loading={busy === "form"}>Send reset code</Primary>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              <Field label="Code"><CodeInput value={code} onChange={setCode} /></Field>
              <Field label="New password">
                <PasswordInput autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </Field>
              <ErrorText>{error}</ErrorText>
              <Note>Other devices signed in to this account will stay signed in.</Note>
              <Primary type="submit" loading={busy === "form"} disabled={code.length < 6 || newPassword.length < 8}>Reset & sign in</Primary>
            </form>
          )}
        </>
      )}
    </AuthLayout>
  );
}
