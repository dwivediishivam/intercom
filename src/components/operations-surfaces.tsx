"use client";

import { type FormEvent, type ReactNode, useState } from "react";

type Notice = (message: string) => void;
type SettingsTab = "team" | "workspace" | "email" | "widget" | "domains" | "developers";

const analyticsBars = [24, 38, 44, 26, 30, 53, 69, 61, 76, 58, 42, 34];

const teamMembers = [
  { name: "Aditi Sharma", initials: "AS", role: "Admin", location: "Mumbai", tone: "current" },
  { name: "Kavya Iyer", initials: "KI", role: "Agent", location: "Bengaluru", tone: "sage" },
  { name: "Rohan Mehta", initials: "RM", role: "Agent", location: "New Delhi", tone: "sand" },
];

export function AnalyticsSurface({ onToast }: { onToast: Notice }) {
  const [range, setRange] = useState("Last 30 days");
  return (
    <section className="content-surface analytics-surface" aria-label="Analytics">
      <header className="content-header"><div><span className="eyebrow">ANALYTICS</span><h1>Make every reply count.</h1><p>Understand volume, speed, SLA health, and the support moments that need attention.</p></div><label className="date-select"><span>Date range</span><select value={range} onChange={(event) => { setRange(event.target.value); onToast(`Analytics updated for ${event.target.value.toLowerCase()}`); }}><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select></label></header>
      <div className="analytics-body">
        <div className="metric-grid"><Metric label="Conversations" value="1,284" change="↑ 12.6%" good /><Metric label="First response" value="8m 42s" change="↓ 1m 18s" good /><Metric label="Resolution time" value="4h 18m" change="↓ 9.4%" good /><Metric label="SLA attained" value="94.8%" change="2 breaches" /></div>
        <div className="analytics-grid"><section className="analytics-card analytics-card--wide"><header><div><span className="panel-label">CONVERSATION VOLUME</span><h2>Steady, with a mid-week peak.</h2></div><span className="legend"><i /> All conversations</span></header><div className="bar-chart" aria-label="Conversation volume chart">{analyticsBars.map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{index % 2 ? "" : `${index + 1} Aug`}</small></div>)}</div></section><section className="analytics-card"><header><div><span className="panel-label">BY CHANNEL</span><h2>Where customers start.</h2></div></header><div className="channel-breakdown"><div><i className="channel-breakdown__chat" /><span>Live chat</span><strong>68%</strong></div><div><i className="channel-breakdown__email" /><span>Email</span><strong>32%</strong></div></div><div className="donut" aria-label="68 percent chat and 32 percent email"><span>1,284<small>conversations</small></span></div></section></div>
        <div className="analytics-grid"><section className="analytics-card"><header><div><span className="panel-label">BUSIEST HOURS</span><h2>Plan coverage around 11:00.</h2></div></header><div className="hour-strip">{[12, 20, 31, 46, 74, 92, 86, 64, 39, 25, 17, 9].map((height, index) => <span key={index} style={{ height: `${height}%` }} title={`${index + 8}:00`} />)}</div><div className="hour-strip__labels"><span>08:00</span><span>12:00</span><span>16:00</span><span>19:00</span></div></section><section className="analytics-card"><header><div><span className="panel-label">SLA HEALTH</span><h2>Most conversations stay on track.</h2></div></header><div className="sla-progress"><div><span>Met</span><strong>94.8%</strong><i><b style={{ width: "94.8%" }} /></i></div><div><span>At risk</span><strong>3.7%</strong><i><b style={{ width: "3.7%" }} /></i></div><div><span>Breached</span><strong>1.5%</strong><i><b style={{ width: "1.5%" }} /></i></div></div></section></div>
        <section className="analytics-card performance-card"><header><div><span className="panel-label">AGENT PERFORMANCE</span><h2>Clear signals, not surveillance.</h2></div><button className="text-button" onClick={() => onToast("CSV export prepared")}>Export CSV</button></header><div className="performance-table"><div className="performance-table__head"><span>AGENT</span><span>ASSIGNED</span><span>RESOLVED</span><span>FIRST REPLY</span><span>SLA</span></div>{teamMembers.map((member, index) => <div className="performance-table__row" key={member.name}><span><i className={`avatar avatar--${member.tone}`}>{member.initials}</i><strong>{member.name}</strong></span><span>{[218, 171, 129][index]}</span><span>{[207, 160, 122][index]}</span><span>{["7m 24s", "8m 57s", "10m 11s"][index]}</span><span className="status-chip status-chip--met">{["97.2%", "95.8%", "92.9%"][index]}</span></div>)}</div></section>
      </div>
    </section>
  );
}

function Metric({ label, value, change, good = false }: { label: string; value: string; change: string; good?: boolean }) {
  return <section className="metric-card"><span>{label}</span><strong>{value}</strong><small className={good ? "metric-card__good" : ""}>{change}</small></section>;
}

export function SettingsSurface({ onToast }: { onToast: Notice }) {
  const [tab, setTab] = useState<SettingsTab>("team");
  const [domain, setDomain] = useState("");
  const [team, setTeam] = useState(teamMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const content = { team: "Team", workspace: "Workspace", email: "Email channel", widget: "Widget install", domains: "Custom domain", developers: "Developers" };
  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const role = String(form.get("role") ?? "Agent");
    if (!email.includes("@")) { onToast("Enter a valid teammate email"); return; }
    const name = email.split("@")[0].split(/[._-]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
    setTeam((current) => [...current, { name, initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2), role, location: "Invitation pending", tone: "peach" }]);
    setInviteOpen(false); onToast(`Invitation sent to ${email}`);
  }
  function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) { onToast("Enter a public hostname such as help.yourcompany.com"); return; }
    onToast(`DNS instructions created for ${domain}`);
  }
  return (
    <section className="content-surface settings-surface" aria-label="Workspace settings"><header className="content-header"><div><span className="eyebrow">SETTINGS</span><h1>Make the workspace yours.</h1><p>Set up access, communication channels, customer-facing domains, and developer integrations.</p></div></header><div className="settings-layout"><nav className="settings-tabs" aria-label="Settings sections">{(Object.keys(content) as SettingsTab[]).map((key) => <button key={key} className={tab === key ? "settings-tabs__active" : ""} onClick={() => setTab(key)}>{content[key]}</button>)}</nav><div className="settings-panel">
      {tab === "team" && <section><SettingsHeading kicker="PEOPLE AND ACCESS" title="A small team with clear ownership." action={<button className="button button--primary" onClick={() => setInviteOpen(true)}>Invite teammate</button>} /><div className="member-list">{team.map((member) => <div key={member.name}><i className={`avatar avatar--${member.tone}`}>{member.initials}</i><span><strong>{member.name}</strong><small>{member.location}</small></span><b>{member.role}</b><button onClick={() => onToast(`${member.name}'s access settings opened`)}>Manage</button></div>)}</div><p className="settings-note">Admins can invite people, change workspace settings, and manage developer credentials. Agents can work with customer conversations.</p></section>}
      {tab === "workspace" && <section><SettingsHeading kicker="WORKSPACE" title="Intercom" /><form className="settings-form" onSubmit={(event) => { event.preventDefault(); onToast("Workspace details saved"); }}><label>Workspace name<input defaultValue="Intercom" /></label><label>Company website<input defaultValue="https://intercom-demo.vercel.app" /></label><label>Default timezone<select defaultValue="Asia/Kolkata"><option>Asia/Kolkata</option><option>Asia/Singapore</option><option>Europe/London</option></select></label><button className="button button--primary">Save changes</button></form></section>}
      {tab === "email" && <section><SettingsHeading kicker="EMAIL CHANNEL" title="A normal email in. A normal email out." /><div className="setup-card"><span className="status-chip status-chip--at-risk">Needs provider setup</span><h3>support@yourdomain.com</h3><p>Point Resend inbound email to this workspace. Incoming mail becomes a threaded conversation and dashboard replies preserve Message-ID headers.</p><ol><li>Verify your domain in Resend.</li><li>Add MX and SPF/DKIM records Resend provides.</li><li>Set the webhook URL to <code>/api/webhooks/resend</code>.</li></ol><button className="button button--secondary" onClick={() => onToast("Email provider setup details copied")}>Copy setup checklist</button></div></section>}
      {tab === "widget" && <section><SettingsHeading kicker="WIDGET INSTALL" title="Install in under a minute." /><div className="setup-card"><span className="status-chip status-chip--met">Ready after deployment</span><p>Add this once just before the closing <code>&lt;/body&gt;</code> tag. It stores a visitor token locally so people can return to the same chat history.</p><pre>{`<script async\n  src="https://your-app.vercel.app/widget.js"\n  data-workspace="your-workspace-public-id">\n</script>`}</pre><button className="button button--secondary" onClick={() => { setCopied(true); onToast("Install script copied"); }}>{copied ? "Copied" : "Copy script"}</button></div></section>}
      {tab === "domains" && <section><SettingsHeading kicker="CUSTOM DOMAIN" title="Your help center, on your domain." /><form className="domain-form" onSubmit={addDomain}><label>Hostname<input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="help.yourcompany.com" /></label><button className="button button--primary">Add domain</button></form><div className="dns-card"><span className="panel-label">HOW IT WORKS</span><ol><li>Add a verification TXT record at <code>_platform-verify.help.yourcompany.com</code>.</li><li>Point your hostname’s CNAME to <code>cname.vercel-dns.com</code>.</li><li>We verify the TXT record, then Vercel provisions and renews TLS.</li></ol><button className="text-button" onClick={() => onToast("DNS verification checks are ready")}>Check verification status</button></div></section>}
      {tab === "developers" && <section><SettingsHeading kicker="DEVELOPERS" title="Connect Intercom to the rest of your stack." /><div className="developer-grid"><div className="setup-card"><span className="panel-label">API TOKEN</span><h3>Production token</h3><p>Use a workspace-scoped Bearer token for programmatic conversation access.</p><button className="button button--secondary" onClick={() => onToast("A new API token can be created after credentials are connected")}>Create token</button></div><div className="setup-card"><span className="panel-label">WEBHOOKS</span><h3>Conversation events</h3><p>Deliver signed events with automatic retry and an inspectable delivery log.</p><label className="switch"><input type="checkbox" checked={webhookEnabled} onChange={(event) => { setWebhookEnabled(event.target.checked); onToast(`Webhook delivery ${event.target.checked ? "enabled" : "paused"}`); }} /><span /><b>{webhookEnabled ? "Enabled" : "Paused"}</b></label></div></div><div className="webhook-events"><span className="panel-label">SUBSCRIBED EVENTS</span><code>conversation.created</code><code>conversation.updated</code><code>message.created</code><button className="text-button" onClick={() => onToast("Webhook event picker opened")}>Manage events</button></div></section>}
    </div></div>
      {inviteOpen && <div className="modal-backdrop"><form className="invite-modal" onSubmit={invite}><header><div><span className="eyebrow">TEAM MEMBER</span><h2>Invite a teammate</h2></div><button type="button" className="modal-close" onClick={() => setInviteOpen(false)}>×</button></header><label>Email address<input name="email" type="email" placeholder="teammate@company.com" autoFocus /></label><label>Role<select name="role"><option>Agent</option><option>Admin</option></select></label><p>They will receive a secure, one-time link to join this workspace.</p><footer><button type="button" className="button button--secondary" onClick={() => setInviteOpen(false)}>Cancel</button><button className="button button--primary">Send invitation</button></footer></form></div>}
    </section>
  );
}

function SettingsHeading({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return <header className="settings-heading"><div><span className="panel-label">{kicker}</span><h2>{title}</h2></div>{action}</header>;
}
