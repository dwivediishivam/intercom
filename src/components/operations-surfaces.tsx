"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";

type Notice = (message: string) => void;
type SettingsTab = "team" | "workspace" | "email" | "widget" | "domains" | "developers";

type WorkspaceMember = { id: string; name: string; initials: string; role: string; location: string; tone: "current" | "sage" | "sand" | "peach" };
type WorkspaceDomain = { id: string; hostname: string; status: string; verification_checked_at: string | null; failure_reason: string | null };
type ApiToken = { id: string; name: string; token_prefix: string; scopes: string[]; last_used_at: string | null; revoked_at: string | null; created_at: string };
type WebhookSubscription = { id: string; url: string; event_types: string[]; active: boolean; created_at: string };

type LiveAnalytics = {
  volume: number;
  resolved: number;
  channels: { chat: number; email: number };
  averageFirstResponseSeconds: number | null;
  averageResolutionSeconds: number | null;
  busiestHours: Array<{ hour: number; conversations: number }>;
  agentPerformance: Array<{ agentId: string; assigned: number; resolved: number; averageFirstResponseSeconds: number | null }>;
};

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function AnalyticsSurface({ onToast, workspaceId, members = [] }: { onToast: Notice; workspaceId?: string; members?: WorkspaceMember[] }) {
  const [range, setRange] = useState("Last 30 days");
  const [liveAnalytics, setLiveAnalytics] = useState<LiveAnalytics | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const rangeDays = range === "Last 7 days" ? 7 : range === "Last 90 days" ? 90 : 30;
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    void fetch(`/api/workspaces/${workspaceId}/analytics?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then(async (response) => {
        const payload = await response.json() as LiveAnalytics & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Analytics could not be loaded.");
        if (active) setLiveAnalytics(payload);
      })
      .catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : "Analytics could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rangeDays, refreshKey, workspaceId]);
  const busiest = liveAnalytics?.busiestHours.slice(8, 20).map((item) => item.conversations) ?? Array.from({ length: 12 }, () => 0);
  const busiestMax = Math.max(...busiest, 1);
  const resolutionRate = liveAnalytics?.volume ? `${Math.round((liveAnalytics.resolved / liveAnalytics.volume) * 100)}%` : "—";
  const performance = liveAnalytics?.agentPerformance.length
    ? liveAnalytics.agentPerformance.map((agent, index) => {
      const member = members.find((candidate) => candidate.id === agent.agentId);
      return { name: member?.name ?? "Former teammate", initials: member?.initials ?? "—", assigned: agent.assigned, resolved: agent.resolved, firstReply: formatDuration(agent.averageFirstResponseSeconds), sla: agent.assigned ? `${Math.round((agent.resolved / agent.assigned) * 100)}%` : "—", tone: member?.tone ?? (["current", "sage", "sand"] as const)[index % 3] };
    })
    : [];
  if (!workspaceId) return <section className="content-surface analytics-surface"><div className="surface-placeholder"><h1>Analytics needs a workspace.</h1><p>Sign in to view actual conversation data.</p></div></section>;
  if (loading) return <section className="content-surface analytics-surface"><div className="surface-placeholder"><span className="eyebrow">ANALYTICS</span><h1>Loading workspace analytics…</h1><p>We’re calculating this from your stored conversations.</p></div></section>;
  if (error) return <section className="content-surface analytics-surface"><div className="surface-placeholder"><span className="eyebrow">ANALYTICS</span><h1>Analytics could not be loaded.</h1><p>{error}</p><button className="button button--primary" onClick={() => setRefreshKey((current) => current + 1)}>Try again</button></div></section>;
  if (!liveAnalytics || liveAnalytics.volume === 0) return <section className="content-surface analytics-surface"><header className="content-header"><div><span className="eyebrow">ANALYTICS</span><h1>Analytics will grow with your inbox.</h1><p>There are no customer conversations in this date range yet. Send a chat from the widget demo or route an email in to begin tracking real data.</p></div><button className="button button--secondary" onClick={() => setRefreshKey((current) => current + 1)}>Refresh data</button></header></section>;
  return (
    <section className="content-surface analytics-surface" aria-label="Analytics">
      <header className="content-header"><div><span className="eyebrow">ANALYTICS</span><h1>Make every reply count.</h1><p>Understand volume, speed, SLA health, and the support moments that need attention.</p></div><div className="header-actions"><label className="date-select"><span>Date range</span><select value={range} onChange={(event) => setRange(event.target.value)}><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select></label><button className="button button--secondary" onClick={() => setRefreshKey((current) => current + 1)}>Refresh</button></div></header>
      <div className="analytics-body">
        <div className="metric-grid"><Metric label="Conversations" value={String(liveAnalytics.volume)} change={`${range} selected`} good /><Metric label="First response" value={formatDuration(liveAnalytics.averageFirstResponseSeconds)} change="Actual response average" good /><Metric label="Resolution time" value={formatDuration(liveAnalytics.averageResolutionSeconds)} change="Actual resolution average" good /><Metric label="Resolved" value={resolutionRate} change={`${liveAnalytics.resolved} conversations`} /></div>
        <div className="analytics-grid"><section className="analytics-card analytics-card--wide"><header><div><span className="panel-label">CONVERSATION VOLUME</span><h2>Your busiest hours at a glance.</h2></div><span className="legend"><i /> All conversations</span></header><div className="bar-chart" aria-label="Conversation volume chart">{busiest.map((value, index) => <div key={index}><span style={{ height: `${value ? Math.max(4, (value / busiestMax) * 100) : 2}%` }} /><small>{index % 2 ? "" : `${index + 8}:00`}</small></div>)}</div></section><section className="analytics-card"><header><div><span className="panel-label">BY CHANNEL</span><h2>Where customers start.</h2></div></header><div className="channel-breakdown"><div><i className="channel-breakdown__chat" /><span>Live chat</span><strong>{liveAnalytics.channels.chat}</strong></div><div><i className="channel-breakdown__email" /><span>Email</span><strong>{liveAnalytics.channels.email}</strong></div></div><div className="donut" aria-label="Channel distribution"><span>{liveAnalytics.volume}<small>conversations</small></span></div></section></div>
        <div className="analytics-grid"><section className="analytics-card"><header><div><span className="panel-label">BUSIEST HOURS</span><h2>{liveAnalytics?.volume ? "Plan coverage around your peaks." : "Coverage patterns will build over time."}</h2></div></header><div className="hour-strip">{busiest.map((value, index) => <span key={index} style={{ height: `${value ? Math.max(4, (value / busiestMax) * 100) : 3}%` }} title={`${index + 8}:00`} />)}</div><div className="hour-strip__labels"><span>08:00</span><span>12:00</span><span>16:00</span><span>19:00</span></div></section><section className="analytics-card"><header><div><span className="panel-label">SLA HEALTH</span><h2>{liveAnalytics?.volume ? "Resolution signals at a glance." : "SLA signals will appear with customer activity."}</h2></div></header><div className="sla-progress"><div><span>Resolved</span><strong>{resolutionRate}</strong><i><b style={{ width: liveAnalytics?.volume ? resolutionRate : "0%" }} /></i></div><div><span>Open</span><strong>{liveAnalytics ? String(liveAnalytics.volume - liveAnalytics.resolved) : "—"}</strong><i><b style={{ width: "0%" }} /></i></div></div></section></div>
        <section className="analytics-card performance-card"><header><div><span className="panel-label">AGENT PERFORMANCE</span><h2>Clear signals, not surveillance.</h2></div><button className="text-button" onClick={() => onToast("CSV export will be available after the first tracked conversations")}>Export CSV</button></header><div className="performance-table"><div className="performance-table__head"><span>AGENT</span><span>ASSIGNED</span><span>RESOLVED</span><span>FIRST REPLY</span><span>SLA</span></div>{performance.length ? performance.map((member) => <div className="performance-table__row" key={member.name}><span><i className={`avatar avatar--${member.tone}`}>{member.initials}</i><strong>{member.name}</strong></span><span>{member.assigned}</span><span>{member.resolved}</span><span>{member.firstReply}</span><span className="status-chip status-chip--met">{member.sla}</span></div>) : <p className="settings-note">Agent performance appears once a teammate is assigned a conversation.</p>}</div></section>
      </div>
    </section>
  );
}

function Metric({ label, value, change, good = false }: { label: string; value: string; change: string; good?: boolean }) {
  return <section className="metric-card"><span>{label}</span><strong>{value}</strong><small className={good ? "metric-card__good" : ""}>{change}</small></section>;
}

export function SettingsSurface({ onToast, workspaceId, workspacePublicId, workspaceName = "Workspace", workspaceSlug = "workspace", appUrl, inboundEmailDomain, members = [], isAdmin = false }: { onToast: Notice; workspaceId?: string; workspacePublicId?: string; workspaceName?: string; workspaceSlug?: string; appUrl?: string | null; inboundEmailDomain?: string | null; members?: WorkspaceMember[]; isAdmin?: boolean }) {
  const [tab, setTab] = useState<SettingsTab>("team");
  const [domain, setDomain] = useState("");
  const [team, setTeam] = useState<WorkspaceMember[]>(members);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dnsInstructions, setDnsInstructions] = useState<Array<{ type: string; host: string; value: string; purpose: string }>>([]);
  const [widgetOrigins, setWidgetOrigins] = useState<string[]>([]);
  const [originDraft, setOriginDraft] = useState("");
  const [domains, setDomains] = useState<WorkspaceDomain[]>([]);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [cannedTitle, setCannedTitle] = useState("");
  const [cannedBody, setCannedBody] = useState("");
  const content = { team: "Team", workspace: "Workspace", email: "Email channel", widget: "Widget install", domains: "Custom domain", developers: "Developers" };
  const availableTabs = (Object.keys(content) as SettingsTab[]).filter((key) => isAdmin || !["domains", "developers"].includes(key));
  const widgetSnippet = `<script async\n  src="${appUrl || "https://your-app.vercel.app"}/widget.js"\n  data-workspace="${workspacePublicId ?? "your-workspace-public-id"}">\n</script>`;
  async function copyText(value: string, confirmation: string) {
    try {
      await navigator.clipboard.writeText(value);
      onToast(confirmation);
    } catch {
      onToast("Clipboard access was blocked. Select and copy the text manually.");
    }
  }
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    const requests = [
      fetch(`/api/workspaces/${workspaceId}/widget-origins`).then(async (response) => ({ kind: "origins" as const, response, payload: await response.json() as { origins?: string[] } })),
      ...(isAdmin ? [
        fetch(`/api/workspaces/${workspaceId}/domains`).then(async (response) => ({ kind: "domains" as const, response, payload: await response.json() as { domains?: WorkspaceDomain[] } })),
        fetch(`/api/workspaces/${workspaceId}/api-tokens`).then(async (response) => ({ kind: "tokens" as const, response, payload: await response.json() as { apiTokens?: ApiToken[] } })),
        fetch(`/api/workspaces/${workspaceId}/webhooks`).then(async (response) => ({ kind: "webhooks" as const, response, payload: await response.json() as { subscriptions?: WebhookSubscription[] } })),
      ] : []),
    ];
    void Promise.all(requests).then((results) => {
      if (!active) return;
      for (const result of results) {
        if (!result.response.ok) continue;
        if (result.kind === "origins") setWidgetOrigins(result.payload.origins ?? []);
        if (result.kind === "domains") setDomains(result.payload.domains ?? []);
        if (result.kind === "tokens") setApiTokens(result.payload.apiTokens ?? []);
        if (result.kind === "webhooks") setWebhooks(result.payload.subscriptions ?? []);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isAdmin, workspaceId]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const role = String(form.get("role") ?? "Agent");
    let deliveryWarning: string | null = null;
    if (!email.includes("@")) { onToast("Enter a valid teammate email"); return; }
    const name = email.split("@")[0].split(/[._-]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
    if (workspaceId) {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role: role.toLowerCase() }) });
        const payload = await response.json() as { error?: string; emailDelivered?: boolean; warning?: string };
        if (!response.ok) throw new Error(payload.error ?? "Invitation could not be sent.");
        if (payload.emailDelivered === false) deliveryWarning = payload.warning ?? "Invitation created, but email delivery needs configuration.";
      } catch (error) { onToast(error instanceof Error ? error.message : "Invitation could not be sent."); return; }
    }
    setTeam((current) => [...current, { id: `pending-${email}`, name, initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2), role, location: "Invitation pending", tone: "peach" }]);
    setInviteOpen(false); onToast(deliveryWarning ?? (workspaceId ? `Invitation created for ${email}` : `Invitation sent to ${email}`));
  }
  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) { onToast("Enter a public hostname such as help.yourcompany.com"); return; }
    if (workspaceId) {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/domains`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostname: domain }) });
        const payload = await response.json() as { domain?: WorkspaceDomain; dns?: { records?: Array<{ type: string; host: string; value: string; purpose: string }> }; error?: string };
        if (!response.ok || !payload.dns?.records) throw new Error(payload.error ?? "Domain could not be added.");
        setDnsInstructions(payload.dns.records);
        if (payload.domain) setDomains((current) => [payload.domain!, ...current]);
      } catch (error) { onToast(error instanceof Error ? error.message : "Domain could not be added."); return; }
    }
    onToast(`DNS instructions created for ${domain}`);
    setDomain("");
  }
  async function addWidgetOrigin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let origin: string;
    try { origin = new URL(originDraft).origin; } catch { onToast("Enter a full site origin such as https://www.yourcompany.com"); return; }
    const nextOrigins = [...new Set([...widgetOrigins, origin])];
    if (workspaceId) {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/widget-origins`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ origins: nextOrigins }) });
        const payload = await response.json() as { origins?: string[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Approved origins could not be saved.");
        setWidgetOrigins(payload.origins ?? nextOrigins);
      } catch (error) { onToast(error instanceof Error ? error.message : "Approved origins could not be saved."); return; }
    } else setWidgetOrigins(nextOrigins);
    setOriginDraft("");
    onToast("Approved widget origin saved");
  }
  async function removeWidgetOrigin(origin: string) {
    const nextOrigins = widgetOrigins.filter((item) => item !== origin);
    if (workspaceId) {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/widget-origins`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ origins: nextOrigins }) });
        const payload = await response.json() as { origins?: string[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Approved origins could not be saved.");
        setWidgetOrigins(payload.origins ?? nextOrigins);
      } catch (error) { onToast(error instanceof Error ? error.message : "Approved origins could not be saved."); return; }
    } else setWidgetOrigins(nextOrigins);
    onToast("Approved widget origin removed");
  }
  async function updateMemberRole(member: WorkspaceMember, role: string) {
    if (!workspaceId || member.id.startsWith("pending-")) return;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: role.toLowerCase() }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Member role could not be changed.");
      setTeam((current) => current.map((item) => item.id === member.id ? { ...item, role } : item));
      onToast(`${member.name} is now an ${role}.`);
    } catch (error) { onToast(error instanceof Error ? error.message : "Member role could not be changed."); }
  }
  async function verifyDomain(domainToVerify: WorkspaceDomain) {
    if (!workspaceId) return;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/domains/${domainToVerify.id}/verify`, { method: "POST" });
      const payload = await response.json() as { verified?: boolean; domain?: WorkspaceDomain; reason?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Domain verification could not run.");
      if (payload.domain) setDomains((current) => current.map((item) => item.id === payload.domain?.id ? { ...item, ...payload.domain } : item));
      onToast(payload.verified ? `${domainToVerify.hostname} is verified.` : payload.reason ?? "DNS verification is still pending.");
    } catch (error) { onToast(error instanceof Error ? error.message : "Domain verification could not run."); }
  }
  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !tokenName.trim()) { onToast("Name the token before creating it."); return; }
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/api-tokens`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: tokenName.trim(), scopes: ["conversations:read", "conversations:write"] }) });
      const payload = await response.json() as { apiToken?: ApiToken; token?: string; error?: string };
      if (!response.ok || !payload.apiToken || !payload.token) throw new Error(payload.error ?? "API token could not be created.");
      setApiTokens((current) => [payload.apiToken!, ...current]);
      setCreatedToken(payload.token);
      setTokenName("");
      onToast("API token created. Copy it now; it will not be shown again.");
    } catch (error) { onToast(error instanceof Error ? error.message : "API token could not be created."); }
  }
  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/webhooks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: webhookUrl, eventTypes: ["conversation.created", "conversation.updated", "message.created"] }) });
      const payload = await response.json() as { subscription?: WebhookSubscription; error?: string };
      if (!response.ok || !payload.subscription) throw new Error(payload.error ?? "Webhook could not be saved.");
      setWebhooks((current) => [payload.subscription!, ...current]);
      setWebhookUrl("");
      onToast("Webhook subscription created.");
    } catch (error) { onToast(error instanceof Error ? error.message : "Webhook could not be saved."); }
  }
  async function createCannedResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !cannedTitle.trim() || !cannedBody.trim()) { onToast("Add a title and response text first."); return; }
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/canned-responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: cannedTitle.trim(), body: cannedBody.trim(), tags: ["General"] }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Canned response could not be saved.");
      setCannedTitle(""); setCannedBody("");
      onToast("Canned response saved. It is available in every conversation composer.");
    } catch (error) { onToast(error instanceof Error ? error.message : "Canned response could not be saved."); }
  }
  return (
    <section className="content-surface settings-surface" aria-label="Workspace settings"><header className="content-header"><div><span className="eyebrow">SETTINGS</span><h1>Make the workspace yours.</h1><p>Set up access, communication channels, custom domains, and developer integrations.</p></div></header><div className="settings-layout"><nav className="settings-tabs" aria-label="Settings sections">{availableTabs.map((key) => <button key={key} className={tab === key ? "settings-tabs__active" : ""} onClick={() => setTab(key)}>{content[key]}</button>)}</nav><div className="settings-panel">
      {tab === "team" && <section><SettingsHeading kicker="PEOPLE AND ACCESS" title="A small team with clear ownership." action={isAdmin ? <button className="button button--primary" onClick={() => setInviteOpen(true)}>Invite teammate</button> : undefined} /><div className="member-list">{team.length ? team.map((member) => <div key={member.id}><i className={`avatar avatar--${member.tone}`}>{member.initials}</i><span><strong>{member.name}</strong><small>{member.location}</small></span><select aria-label={`Role for ${member.name}`} value={member.role} disabled={!isAdmin || member.id.startsWith("pending-")} onChange={(event) => void updateMemberRole(member, event.target.value)}><option>Admin</option><option>Agent</option></select></div>) : <p className="settings-note">Your first teammate will appear here after they accept an invitation.</p>}</div><p className="settings-note">Admins can invite people, change workspace settings, and manage developer credentials. Agents can work with customer conversations.</p></section>}
      {tab === "workspace" && <section><SettingsHeading kicker="WORKSPACE" title={workspaceName} /><div className="setup-card"><span className="panel-label">WORKSPACE IDENTITY</span><h3>{workspaceName}</h3><p>Your workspace slug is <code>{workspaceSlug}</code>. It provides the default email alias for your inbound support channel.</p></div></section>}
      {tab === "email" && <section><SettingsHeading kicker="EMAIL CHANNEL" title="A normal email in. A normal email out." /><div className="setup-card"><span className={`status-chip ${inboundEmailDomain ? "status-chip--met" : "status-chip--at-risk"}`}>{inboundEmailDomain ? "Provider connected" : "Provider needs setup"}</span><h3>{inboundEmailDomain ? `${workspaceSlug}@${inboundEmailDomain}` : "Configure your inbound address"}</h3><p>Incoming email becomes a threaded conversation. Dashboard replies preserve Message-ID headers and send the workspace alias as Reply-To.</p><ol><li>Send a test email to your configured Resend receiving address using this workspace slug.</li><li>Watch it arrive in the unified inbox.</li><li>Reply from the dashboard and confirm the normal email thread.</li></ol><button className="button button--secondary" onClick={() => void copyText("1. Send a test email to the configured Resend receiving address using this workspace slug.\n2. Refresh the inbox and open the new conversation.\n3. Reply from the dashboard and confirm it stays in the original email thread.", "Email test checklist copied")}>Copy test checklist</button></div></section>}
      {tab === "widget" && <section><SettingsHeading kicker="WIDGET INSTALL" title="Install in under a minute." /><div className="setup-card"><span className="status-chip status-chip--met">Ready after deployment</span><p>Add this once just before the closing <code>&lt;/body&gt;</code> tag. It stores a visitor token locally so people can return to the same chat history.</p><pre>{widgetSnippet}</pre><div className="header-actions"><button className="button button--secondary" onClick={() => { void copyText(widgetSnippet, "Install script copied"); setCopied(true); }}>{copied ? "Copied" : "Copy script"}</button>{workspacePublicId && <a className="button button--primary" href={`/demo?workspace=${workspacePublicId}`} target="_blank" rel="noreferrer">Open live demo</a>}</div></div>{isAdmin && <form className="domain-form widget-origin-form" onSubmit={addWidgetOrigin}><label>Approved website origin<input value={originDraft} onChange={(event) => setOriginDraft(event.target.value)} placeholder="https://www.yourcompany.com" /></label><button className="button button--secondary">Add origin</button></form>}{widgetOrigins.length > 0 && <div className="origin-list">{widgetOrigins.map((origin) => <span key={origin}>{origin}{isAdmin && <button onClick={() => void removeWidgetOrigin(origin)} aria-label={`Remove ${origin}`}>×</button>}</span>)}</div>}<p className="settings-note">Only approved origins can use this workspace’s embedded widget.</p></section>}
      {tab === "domains" && <section><SettingsHeading kicker="CUSTOM DOMAIN" title="Your help center, on your domain." /><form className="domain-form" onSubmit={addDomain}><label>Hostname<input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="help.yourcompany.com" /></label><button className="button button--primary">Add domain</button></form><div className="dns-card"><span className="panel-label">HOW IT WORKS</span>{dnsInstructions.length ? <ol>{dnsInstructions.map((record) => <li key={`${record.type}-${record.host}`}><strong>{record.type}</strong> <code>{record.host}</code> → <code>{record.value}</code><br />{record.purpose}</li>)}</ol> : <ol><li>Add a verification TXT record at <code>_platform-verify.help.yourcompany.com</code>.</li><li>Point your hostname’s CNAME to <code>cname.vercel-dns.com</code>.</li><li>We verify the TXT record, then Vercel provisions and renews TLS.</li></ol>}</div>{domains.length > 0 && <div className="domain-status-list">{domains.map((item) => <div key={item.id}><span><strong>{item.hostname}</strong><small>{item.failure_reason || (item.verification_checked_at ? `Checked ${new Date(item.verification_checked_at).toLocaleString()}` : "Awaiting DNS verification")}</small></span><b className={`status-chip ${item.status === "active" ? "status-chip--met" : item.status === "failed" ? "status-chip--breached" : "status-chip--at-risk"}`}>{item.status.replaceAll("_", " ")}</b><button className="button button--secondary" onClick={() => void verifyDomain(item)}>Verify DNS</button></div>)}</div>}</section>}
      {tab === "developers" && <section><SettingsHeading kicker="DEVELOPERS" title="Connect Intercom to the rest of your stack." /><div className="developer-grid"><div className="setup-card"><span className="panel-label">API TOKEN</span><h3>Create a scoped token</h3><p>Tokens are workspace-scoped. The secret is shown only once.</p><form className="compact-form" onSubmit={createToken}><input value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder="Production integration" /><button className="button button--secondary">Create token</button></form>{createdToken && <div className="secret-reveal"><code>{createdToken}</code><button className="text-button" onClick={() => { navigator.clipboard?.writeText(createdToken); onToast("Token copied"); }}>Copy</button><button className="text-button" onClick={() => setCreatedToken(null)}>Hide</button></div>}{apiTokens.length > 0 && <ul className="token-list">{apiTokens.map((token) => <li key={token.id}><span><strong>{token.name}</strong><small>{token.token_prefix}… · {token.last_used_at ? `used ${new Date(token.last_used_at).toLocaleDateString()}` : "not used yet"}</small></span><code>{token.scopes.join(", ")}</code></li>)}</ul>}</div><div className="setup-card"><span className="panel-label">WEBHOOKS</span><h3>Subscribe to events</h3><p>Deliver signed conversation events with automatic retry.</p><form className="compact-form" onSubmit={createWebhook}><input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/intercom-webhook" type="url" /><button className="button button--secondary">Add webhook</button></form>{webhooks.length > 0 && <ul className="token-list">{webhooks.map((webhook) => <li key={webhook.id}><span><strong>{webhook.url}</strong><small>{webhook.active ? "Active" : "Paused"}</small></span><code>{webhook.event_types.length} events</code></li>)}</ul>}</div></div><section className="setup-card canned-response-card"><span className="panel-label">CANNED RESPONSES</span><h3>Save a reply your team can reuse.</h3><form className="compact-form compact-form--stacked" onSubmit={createCannedResponse}><input value={cannedTitle} onChange={(event) => setCannedTitle(event.target.value)} placeholder="Reply title" /><textarea value={cannedBody} onChange={(event) => setCannedBody(event.target.value)} placeholder="Write the saved reply…" /><button className="button button--secondary">Save canned response</button></form></section></section>}
    </div></div>
      {inviteOpen && <div className="modal-backdrop"><form className="invite-modal" onSubmit={invite}><header><div><span className="eyebrow">TEAM MEMBER</span><h2>Invite a teammate</h2></div><button type="button" className="modal-close" onClick={() => setInviteOpen(false)}>×</button></header><label>Email address<input name="email" type="email" placeholder="teammate@company.com" autoFocus /></label><label>Role<select name="role"><option>Agent</option><option>Admin</option></select></label><p>They will receive a secure, one-time link to join this workspace.</p><footer><button type="button" className="button button--secondary" onClick={() => setInviteOpen(false)}>Cancel</button><button className="button button--primary">Send invitation</button></footer></form></div>}
    </section>
  );
}

function SettingsHeading({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return <header className="settings-heading"><div><span className="panel-label">{kicker}</span><h2>{title}</h2></div>{action}</header>;
}
