"use client";

import { useEffect, useState } from "react";

import { WidgetDemoSurface } from "@/components/knowledge-and-widget";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A real host page for manual widget testing after a workspace is created. */
export function LiveWidgetDemo() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const requestedWorkspace = new URLSearchParams(window.location.search).get("workspace");
    if (!requestedWorkspace) return;
    const timer = window.setTimeout(() => {
      if (!uuidPattern.test(requestedWorkspace)) {
        setMessage("The workspace parameter must be a valid public workspace ID.");
        return;
      }
      setWorkspaceId(requestedWorkspace);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
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

  if (!workspaceId) return <><WidgetDemoSurface onToast={setMessage} />{message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}</>;
  return <main className="live-widget-host"><nav><span>Papertrail</span><a>Features</a><a>Pricing</a><button>Start free</button></nav><section><span className="eyebrow">PAPERTRAIL FOR TEAMS</span><h1>A calmer way to build together.</h1><p>This is a real external-host simulation. Open the support launcher to send a message into the configured Intercom workspace.</p><button>Explore the product</button></section><footer><code>{`Workspace ${workspaceId}`}</code><span>Widget source: /widget.js</span></footer>{message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}</main>;
}
