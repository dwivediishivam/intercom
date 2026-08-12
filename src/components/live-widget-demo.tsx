"use client";

import { FormEvent, useEffect, useState } from "react";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A real external-host simulation for the embeddable widget. */
export function LiveWidgetDemo() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const requestedWorkspace = new URLSearchParams(window.location.search).get("workspace")?.trim() ?? "";
    if (!requestedWorkspace) return;
    setWorkspaceInput(requestedWorkspace);
    if (uuidPattern.test(requestedWorkspace)) setWorkspaceId(requestedWorkspace);
    else setMessage("That workspace link is invalid. Open the live demo from Widget install in your workspace settings.");
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    document.querySelector("[data-intercom-widget]")?.remove();
    const script = document.createElement("script");
    script.async = true;
    script.src = "/widget.js";
    script.dataset.workspace = workspaceId;
    document.body.append(script);
    return () => {
      script.remove();
      document.querySelector("[data-intercom-widget]")?.remove();
    };
  }, [workspaceId]);

  function beginDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requested = workspaceInput.trim();
    if (!uuidPattern.test(requested)) {
      setMessage("Enter the public workspace ID from Settings → Widget install.");
      return;
    }
    window.history.replaceState({}, "", `/demo?workspace=${encodeURIComponent(requested)}`);
    setMessage(null);
    setWorkspaceId(requested);
  }

  async function copySnippet() {
    if (!workspaceId) return;
    const snippet = `<script async src="${window.location.origin}/widget.js" data-workspace="${workspaceId}"></script>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Clipboard access was blocked. Copy the install snippet from Widget install in the dashboard.");
    }
  }

  if (!workspaceId) {
    return <main className="widget-demo-setup">
      <nav className="widget-demo-setup__nav"><a href="/" className="landing-brand"><span>i</span>Intercom</a><a href="/login">Sign in</a></nav>
      <section className="widget-demo-setup__hero">
        <span className="eyebrow">LIVE WIDGET TEST</span>
        <h1>A real website.<br />A real conversation.</h1>
        <p>This page is the customer-facing test site for your embedded chat. Create a workspace first, then use the public workspace ID from <strong>Settings → Widget install</strong> to load your actual widget here.</p>
        <form onSubmit={beginDemo} className="widget-demo-setup__form">
          <label>Public workspace ID<input value={workspaceInput} onChange={(event) => setWorkspaceInput(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" /></label>
          <button className="landing-button landing-button--primary">Load my widget <b>↗</b></button>
        </form>
        <div className="widget-demo-setup__steps"><span><b>1</b>Create a workspace</span><span><b>2</b>Open Widget install</span><span><b>3</b>Send a chat here</span></div>
      </section>
      {message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}
    </main>;
  }

  return <main className="live-widget-host">
    <nav><a href="/" className="live-widget-host__brand"><i>i</i>Intercom</a><span className="live-widget-host__label">Widget test site</span><a href="#how-it-works">How it works</a><a href="/app">Open inbox</a></nav>
    <section>
      <span className="eyebrow">NORTHSTAR COLLECTIVE</span>
      <h1>Support that feels close, wherever your customers are.</h1>
      <p>This is an independent customer-facing page with your live Intercom script installed. Open the launcher in the lower-right, send a message, then refresh your signed-in inbox to see it arrive.</p>
      <div className="live-widget-host__actions"><button onClick={copySnippet}>{copied ? "Snippet copied" : "Copy install snippet"}</button><a href="/app">View unified inbox</a></div>
    </section>
    <aside id="how-it-works" className="live-widget-host__guide"><span>01 · Message from this page</span><span>02 · It becomes a chat conversation</span><span>03 · Reply from the dashboard</span></aside>
    <footer><code>{`data-workspace="${workspaceId}"`}</code><span>Messages and chat history use the connected workspace—not a mock dataset.</span></footer>
    {message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}
  </main>;
}
