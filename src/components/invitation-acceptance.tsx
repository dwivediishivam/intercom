"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function InvitationAcceptance() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [state, setState] = useState<"checking" | "ready" | "accepting" | "accepted" | "error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await createBrowserSupabaseClient().auth.getSession();
        if (!active) return;
        if (!token || token.length < 32) {
          setState("error");
          setMessage("This invitation link is incomplete or invalid.");
        } else if (data.session) setState("ready");
        else {
          setState("error");
          setMessage("Sign in with the invited email address to join this workspace.");
        }
      } catch {
        if (active) { setState("error"); setMessage("We could not check your secure session."); }
      }
    })();
    return () => { active = false; };
  }, [token]);

  async function acceptInvitation() {
    setState("accepting");
    try {
      const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const payload = await response.json() as { error?: string; workspaceId?: string };
      if (!response.ok) throw new Error(payload.error ?? "The invitation could not be accepted.");
      if (!payload.workspaceId) throw new Error("The invitation was accepted, but no workspace was returned.");
      setState("accepted");
      setMessage("Invitation accepted. Opening your workspace…");
      const destination = `/app?workspace=${encodeURIComponent(payload.workspaceId)}`;
      window.setTimeout(() => { router.replace(destination); router.refresh(); }, 350);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The invitation could not be accepted.");
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(`/invite?token=${token}`)}`;
  return <main className="invitation-page"><section><a className="auth-brand" href="/"><i>i</i> Intercom</a><span className="eyebrow invitation-page__eyebrow">WORKSPACE INVITATION</span><h1>Join the conversation.</h1>{state === "checking" ? <p>Checking your secure invitation…</p> : state === "ready" || state === "accepting" ? <><p>You’re signed in. Accept the invitation to join your teammate’s workspace.</p><button className="button button--primary" disabled={state === "accepting"} onClick={() => void acceptInvitation()}>{state === "accepting" ? "Joining workspace…" : "Accept invitation"}</button></> : state === "accepted" ? <p className="auth-message">{message}</p> : <><p className="auth-message auth-message--error">{message}</p><a className="button button--primary" href={loginHref}>Sign in to accept</a></>}</section></main>;
}
