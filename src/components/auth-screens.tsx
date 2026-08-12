"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthMode = "sign-in" | "sign-up";
type AuthMessage = { tone: "error" | "notice"; text: string };

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function AuthenticationSurface({ initialMode = "sign-in" }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function continueWithGoogle() {
    setSubmitting(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ tone: "error", text: readableError(error) });
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/app");
        router.refresh();
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) throw error;
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }
      setVerificationPending(true);
      setMessage({ tone: "notice", text: "We sent a verification link to your inbox. Open it in this browser and we’ll take you straight to workspace setup." });
    } catch (error) {
      setMessage({ tone: "error", text: readableError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-page__panel">
        <Link className="auth-brand" href="/"><i>i</i> Intercom</Link>
        <div className="auth-page__intro"><span className="eyebrow">{mode === "sign-in" ? "WELCOME BACK" : "GET STARTED"}</span><h1>{mode === "sign-in" ? "Good to see you." : "Build a more helpful inbox."}</h1><p>{mode === "sign-in" ? "Sign in to your workspace and pick up exactly where your customers left off." : "Create a workspace for your team, then connect every customer conversation in one place."}</p></div>
        {verificationPending ? (
          <div className="verification-card" role="status">
            <span className="verification-card__icon">✓</span><h2>Verify your email</h2><p>{message?.text}</p>
            <button className="button button--primary" onClick={() => { setVerificationPending(false); setMode("sign-in"); setMessage(null); }}>I’ve verified — sign in</button>
            <button className="text-button" onClick={() => { setVerificationPending(false); setMessage(null); }}>Use a different email</button>
          </div>
        ) : <>
          <button className="google-button" onClick={continueWithGoogle} disabled={submitting}><span className="google-mark">G</span> Continue with Google</button>
          <div className="auth-divider"><span>or continue with email</span></div>
          <form className="auth-form" onSubmit={submit}>
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
            <label>Password<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required /></label>
            {message && <p className={`auth-message auth-message--${message.tone}`} role="status">{message.text}</p>}
            <button className="button button--primary" disabled={submitting}>{submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="auth-switch">{mode === "sign-in" ? "New to Intercom?" : "Already have an account?"} <button onClick={() => { setMode((current) => current === "sign-in" ? "sign-up" : "sign-in"); setMessage(null); }}>{mode === "sign-in" ? "Create an account" : "Sign in"}</button></p>
        </>}
      </section>
      <aside className="auth-page__aside"><span className="eyebrow">ONE HOME FOR CUSTOMERS</span><blockquote>“Fast support feels personal—even when the work happens across the whole team.”</blockquote><div className="auth-page__signals"><span><i className="auth-page__online" />Realtime chat</span><span><i />Threaded email</span><span><i />AI when it helps</span></div></aside>
    </main>
  );
}

export function OnboardingSurface() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let live = true;
    async function checkSession() {
      try {
        const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
        if (!session && live) router.replace("/login");
      } catch (error) {
        if (live) setMessage({ tone: "error", text: readableError(error) });
      } finally {
        if (live) setCheckingSession(false);
      }
    }
    void checkSession();
    return () => { live = false; };
  }, [router]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: workspaceName, slug: workspaceSlug }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create the workspace.");
      router.replace("/app");
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: readableError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="onboarding-page"><section><a className="auth-brand" href="/"><i>i</i> Intercom</a><span className="eyebrow onboarding-page__eyebrow">CREATE YOUR WORKSPACE</span><h1>Give your team a home.</h1><p>Choose a name your teammates will recognise. This is the only setup step; you can invite your team and connect channels from the workspace.</p>{checkingSession ? <p className="onboarding-page__checking">Checking your secure session…</p> : <form onSubmit={createWorkspace}><label>Workspace name<input value={workspaceName} onChange={(event) => { setWorkspaceName(event.target.value); if (!workspaceSlug || workspaceSlug === workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) setWorkspaceSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} placeholder="Monsoon Studio" required /></label><label>Workspace URL<span>intercom.app/</span><input value={workspaceSlug} onChange={(event) => setWorkspaceSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="monsoon-studio" minLength={3} required /></label>{message && <p className={`auth-message auth-message--${message.tone}`} role="status">{message.text}</p>}<button className="button button--primary" disabled={submitting}>{submitting ? "Creating workspace…" : "Create workspace"}</button></form>}</section></main>;
}
