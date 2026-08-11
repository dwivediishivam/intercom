"use client";

import { useEffect, useRef, useState } from "react";

import type { DemoConversation } from "@/lib/demo-data";

type ThreadMessage = {
  id: string;
  author: string;
  initials: string;
  tone: "peach" | "current" | "sage";
  role: "customer" | "agent" | "note";
  body: string;
  time: string;
  readBy?: string;
};

type StoredMessage = {
  id: string;
  sender_type: "contact" | "agent" | "system" | "ai";
  body_text: string;
  sent_at: string;
  delivery_status: string;
};

type CannedResponse = { id: string; title: string; body: string; tags: string[] };
type WorkspaceMember = { id: string; name: string; initials: string; role: string; location: string; tone: "current" | "sage" | "sand" | "peach" };
type ContactTimeline = {
  contact: { name: string | null; email: string | null; created_at: string; last_seen_at: string | null };
  conversations: Array<{ id: string; channel: "chat" | "email"; status: "open" | "snoozed" | "resolved"; subject: string | null; last_message_at: string | null; created_at: string }>;
  pageVisits: Array<{ url: string; title: string | null; visited_at: string }>;
};
type LiveSla = { firstResponse: { dueAt: string | null; breached: boolean; completedAt: string | null }; resolution: { dueAt: string | null; breached: boolean; completedAt: string | null } };

const threadByConversation: Record<string, ThreadMessage[]> = {
  "conv-priya": [
    { id: "priya-1", author: "Priya Raghavan", initials: "PR", tone: "peach", role: "customer", body: "Hi, I’m trying to switch our team to the annual Growth plan. The payment drawer keeps spinning after I confirm payment.", time: "10:03" },
    { id: "priya-2", author: "Aditi Sharma", initials: "AS", tone: "current", role: "agent", body: "I’m on it. Could you confirm the last four digits of the card and whether you see an error after the spinner?", time: "10:06", readBy: "Seen by Priya" },
    { id: "priya-3", author: "Priya Raghavan", initials: "PR", tone: "peach", role: "customer", body: "It was 4812. I tried two cards and Chrome plus Safari—same result. No error message appears.", time: "10:09" },
  ],
};

function defaultThread(conversation: DemoConversation): ThreadMessage[] {
  return [
    { id: `${conversation.id}-1`, author: conversation.name, initials: conversation.initials, tone: "peach", role: "customer", body: conversation.preview, time: "09:42" },
    { id: `${conversation.id}-2`, author: "Aditi Sharma", initials: "AS", tone: "current", role: "agent", body: "Thanks for reaching out. I’m checking this with the team and will update you shortly.", time: "09:47", readBy: conversation.channel === "chat" ? `Seen by ${conversation.name.split(" ")[0]}` : undefined },
  ];
}

function storedMessageToThread(message: StoredMessage, conversation: DemoConversation, currentUser?: { name: string; initials: string }): ThreadMessage {
  const sentAt = new Date(message.sent_at);
  const time = Number.isNaN(sentAt.getTime()) ? "Now" : sentAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (message.sender_type === "contact") {
    return { id: message.id, author: conversation.name, initials: conversation.initials, tone: "peach", role: "customer", body: message.body_text, time };
  }
  return { id: message.id, author: currentUser?.name || "Your team", initials: currentUser?.initials || "YT", tone: "current", role: "agent", body: message.body_text, time, readBy: message.delivery_status === "read" ? "Read" : undefined };
}

function relativeTime(value: string | null) {
  if (!value) return "Not recorded";
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function dueLabel(sla: LiveSla | null) {
  if (!sla) return "SLA will be calculated after the first customer message";
  const target = sla.firstResponse.completedAt ? sla.resolution : sla.firstResponse;
  if (target.completedAt) return "Target met";
  if (!target.dueAt) return "No SLA policy configured";
  return target.breached ? "SLA target breached" : `Due ${relativeTime(target.dueAt).replace("ago", "from now")}`;
}

type Props = {
  conversation: DemoConversation;
  onBack: () => void;
  onToast: (message: string) => void;
  onResolve: () => void;
  onSnooze: () => void;
  isDemo: boolean;
  workspaceId?: string;
  workspaceMembers: WorkspaceMember[];
  currentUser: { id: string; name: string; initials: string; role: string };
  onAssign: (assigneeId: string | null) => Promise<boolean>;
};

export function ConversationWorkspace({ conversation, onBack, onToast, onResolve, onSnooze, isDemo, workspaceId, workspaceMembers, currentUser, onAssign }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(() => isDemo ? threadByConversation[conversation.id] ?? defaultThread(conversation) : []);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [contactTimeline, setContactTimeline] = useState<ContactTimeline | null>(null);
  const [liveSla, setLiveSla] = useState<LiveSla | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isDemo) return;
    let active = true;
    void fetch(`/api/conversations/${conversation.id}/messages`)
      .then(async (response) => {
        const payload = await response.json() as { messages?: StoredMessage[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not load this conversation.");
        if (active) setMessages((payload.messages ?? []).map((message) => storedMessageToThread(message, conversation, currentUser)));
      })
      .catch((error: unknown) => {
        if (active) onToast(error instanceof Error ? error.message : "Could not load this conversation.");
      });
    return () => { active = false; };
  }, [conversation, currentUser, isDemo, onToast]);

  useEffect(() => {
    if (isDemo || !workspaceId) return;
    let active = true;
    void fetch(`/api/workspaces/${workspaceId}/canned-responses`)
      .then(async (response) => {
        const payload = await response.json() as { cannedResponses?: CannedResponse[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Canned responses could not be loaded.");
        if (active) setCannedResponses(payload.cannedResponses ?? []);
      })
      .catch((error: unknown) => { if (active) onToast(error instanceof Error ? error.message : "Canned responses could not be loaded."); });
    return () => { active = false; };
  }, [isDemo, onToast, workspaceId]);

  useEffect(() => {
    if (isDemo || !workspaceId) return;
    let active = true;
    void fetch(`/api/conversations/${conversation.id}/sla`)
      .then(async (response) => {
        const payload = await response.json() as LiveSla & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "SLA could not be loaded.");
        if (active) setLiveSla(payload);
      })
      .catch((error: unknown) => { if (active) onToast(error instanceof Error ? error.message : "SLA could not be loaded."); });
    if (conversation.contactId) {
      void fetch(`/api/workspaces/${workspaceId}/contacts/${conversation.contactId}/timeline`)
        .then(async (response) => {
          const payload = await response.json() as ContactTimeline & { error?: string };
          if (!response.ok) throw new Error(payload.error ?? "Contact timeline could not be loaded.");
          if (active) setContactTimeline(payload);
        })
        .catch((error: unknown) => { if (active) onToast(error instanceof Error ? error.message : "Contact timeline could not be loaded."); });
    }
    return () => { active = false; };
  }, [conversation.contactId, conversation.id, isDemo, onToast, workspaceId]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body) {
      composerRef.current?.focus();
      return;
    }
    if (!isDemo && mode === "reply") {
      try {
        const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bodyText: body, clientMessageId: crypto.randomUUID() }),
        });
        const payload = await response.json() as { message?: StoredMessage; error?: string };
        if (!response.ok || !payload.message) throw new Error(payload.error ?? "Reply could not be sent.");
        const sentMessage = payload.message;
        setMessages((current) => [...current, storedMessageToThread(sentMessage, conversation, currentUser)]);
        setDraft("");
        onToast(`Reply sent to ${conversation.name.split(" ")[0]}`);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Reply could not be sent.");
      }
      return;
    }
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        author: currentUser.name,
        initials: currentUser.initials,
        tone: "current",
        role: mode === "note" ? "note" : "agent",
        body,
        time: "Now",
        readBy: mode === "reply" && conversation.channel === "chat" ? "Delivered" : undefined,
      },
    ]);
    setDraft("");
    onToast(mode === "note" ? "Internal note added" : `Reply sent to ${conversation.name.split(" ")[0]}`);
  }

  async function createSummary() {
    setSummaryLoading(true);
    try {
      if (isDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
      } else {
        const response = await fetch(`/api/conversations/${conversation.id}/ai`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "summary" }) });
        const payload = await response.json() as { summary?: string; error?: string };
        if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Summary could not be generated.");
        setSummaryText(payload.summary);
      }
      setSummaryVisible(true);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Summary could not be generated.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function createDraft() {
    setDraftLoading(true);
    try {
      if (isDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 380));
        setDraft("Thanks for the details, Priya. We’ve identified the payment flow and are checking the final fix now. I’ll send a confirmation as soon as it’s complete—there’s nothing else you need to try at the moment.");
      } else {
        const response = await fetch(`/api/conversations/${conversation.id}/ai`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reply_draft" }) });
        const payload = await response.json() as { draft?: string; error?: string };
        if (!response.ok || !payload.draft) throw new Error(payload.error ?? "Reply draft could not be generated.");
        setDraft(payload.draft);
      }
      composerRef.current?.focus();
      onToast("AI reply draft is ready for review");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Reply draft could not be generated.");
    } finally {
      setDraftLoading(false);
    }
  }

  function insertCannedReply(text: string) {
    setDraft(text);
    setShowCanned(false);
    composerRef.current?.focus();
  }

  async function updateAssignment(value: string) {
    setAssignmentSaving(true);
    try {
      await onAssign(value || null);
    } finally {
      setAssignmentSaving(false);
    }
  }

  return (
    <section className="conversation-workspace" aria-label={`Conversation with ${conversation.name}`}>
      <header className="conversation-workspace__header">
        <button className="back-button" onClick={onBack} aria-label="Back to inbox">← <span>Inbox</span></button>
        <div className="conversation-workspace__identity">
          <span className={`avatar avatar--${conversation.avatarTone}`}>{conversation.initials}</span>
          <div>
            <div className="conversation-workspace__name-row"><h1>{conversation.name}</h1><span className="channel-label">{conversation.channel.toUpperCase()}</span></div>
            <span>{conversation.email} · {conversation.location}</span>
          </div>
        </div>
        <div className="conversation-workspace__actions">
          {!isDemo && <label className="conversation-assignee"><span>Owner</span><select value={conversation.assigneeId ?? ""} onChange={(event) => void updateAssignment(event.target.value)} disabled={assignmentSaving || currentUser.role !== "Admin"} aria-label="Assign conversation"><option value="">Unassigned</option>{workspaceMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
          <button className="icon-action" aria-label="More conversation actions" onClick={() => onToast("Conversation actions are ready")}>•••</button>
          <button className="button button--secondary" onClick={onSnooze}>Snooze</button>
          <button className="button button--primary" onClick={onResolve}>Resolve</button>
        </div>
      </header>

      <div className="conversation-workspace__body">
        <div className="conversation-thread">
          {summaryVisible ? (
            <aside className="ai-summary" aria-live="polite">
              <div className="ai-summary__heading"><span className="sparkle" aria-hidden="true">✦</span><strong>Issue summary</strong><span>Updated just now</span></div>
              {summaryText ? summaryText.split("\n").filter(Boolean).map((line) => <p key={line}>{line}</p>) : <>
                <p><strong>Need:</strong> {conversation.name.split(" ")[0]} needs help with {conversation.subject.toLowerCase()}.</p>
                <p><strong>Tried:</strong> Multiple browsers and payment methods; no inline error is shown.</p>
                <p><strong>Now:</strong> Agent is validating the payment flow and will confirm the resolution.</p>
              </>}
            </aside>
          ) : (
            <button className="summary-trigger" onClick={createSummary} disabled={summaryLoading}>
              <span className="sparkle" aria-hidden="true">✦</span>{summaryLoading ? "Preparing a concise summary…" : "Summarize this conversation"}<span>Uses AI only when requested</span>
            </button>
          )}

          <div className="thread-date">TODAY</div>
          <div className="thread-messages">
            {messages.map((message) => (
              <article className={`thread-message thread-message--${message.role}`} key={message.id}>
                <span className={`avatar avatar--${message.tone}`}>{message.initials}</span>
                <div className="thread-message__content">
                  <div><strong>{message.role === "note" ? `Internal note · ${message.author}` : message.author}</strong><time>{message.time}</time></div>
                  <p>{message.body}</p>
                  {message.readBy && <span className="read-receipt">✓ {message.readBy}</span>}
                </div>
              </article>
            ))}
          </div>

          {isDemo && <div className="typing-indicator"><span /><span /><span /> {conversation.name.split(" ")[0]} is typing</div>}

          <div className="composer">
            <div className="composer__tabs">
              <button className={mode === "reply" ? "composer__tab--active" : ""} onClick={() => setMode("reply")}>Reply</button>
              <button className={mode === "note" ? "composer__tab--active" : ""} onClick={() => setMode("note")}>Internal note</button>
              <span>{mode === "reply" ? (conversation.channel === "email" ? "Replying by email" : "Replying in chat") : "Visible to teammates only"}</span>
            </div>
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={mode === "reply" ? `Reply to ${conversation.name.split(" ")[0]}…` : "Leave context for your teammates…"} aria-label={mode === "reply" ? "Reply message" : "Internal note"} />
            <div className="composer__footer">
              <div className="composer__tools">
                <button className="text-button" onClick={createDraft} disabled={draftLoading}><span className="sparkle" aria-hidden="true">✦</span> {draftLoading ? "Drafting…" : "Draft with AI"}</button>
                <div className="canned-menu">
                  <button className="text-button" onClick={() => setShowCanned((current) => !current)}>⌁ Canned replies</button>
                  {showCanned && <div className="canned-menu__popover">
                    {(isDemo ? [
                      { id: "acknowledgement", title: "Acknowledgement", body: "Thanks for flagging this. I’m looking into it and will share an update shortly.", tags: ["General"] },
                      { id: "billing", title: "Billing follow-up", body: "I’ve passed this to our billing team. We’ll reissue the corrected invoice within one business day.", tags: ["Billing"] },
                      { id: "details", title: "Ask for details", body: "Could you share a screen recording and the email address used to sign in? That will help us investigate faster.", tags: ["Triage"] },
                    ] : cannedResponses).map((response) => <button key={response.id} onClick={() => insertCannedReply(response.body)}>{response.title} <span>{response.tags[0] ?? "Saved reply"}</span></button>)}
                    {!isDemo && !cannedResponses.length && <p>No canned responses yet. Create one in Settings → Developers.</p>}
                  </div>}
                </div>
              </div>
              <button className="button button--primary" onClick={sendMessage}>{mode === "reply" ? "Send reply" : "Add note"} <kbd>⌘↵</kbd></button>
            </div>
          </div>
        </div>

        <aside className="contact-panel" aria-label="Customer context">
          <section>
            <div className="contact-panel__title"><span>CONTACT</span><button onClick={() => onToast("Contact editor is ready")}>Edit</button></div>
            <div className="contact-card">
              <span className={`avatar avatar--${conversation.avatarTone}`}>{conversation.initials}</span>
              <strong>{conversation.name}</strong>
              <a href={`mailto:${conversation.email}`}>{conversation.email}</a>
              <span>{conversation.location} · Last seen {isDemo ? "2m ago" : relativeTime(contactTimeline?.contact.last_seen_at ?? null)}</span>
            </div>
          </section>
          <section>
            <div className="contact-panel__title"><span>CONTEXT</span></div>
            <dl className="context-list">
              {isDemo ? <><div><dt>Plan</dt><dd>Growth · annual</dd></div><div><dt>Owner</dt><dd>Priya Raghavan</dd></div><div><dt>First seen</dt><dd>14 Jan 2026</dd></div><div><dt>Pages viewed</dt><dd>Pricing, Checkout</dd></div></> : <><div><dt>Conversations</dt><dd>{contactTimeline?.conversations.length ?? "—"}</dd></div><div><dt>Pages viewed</dt><dd>{contactTimeline?.pageVisits.length ?? "—"}</dd></div><div><dt>First seen</dt><dd>{relativeTime(contactTimeline?.contact.created_at ?? null)}</dd></div><div><dt>Owner</dt><dd>{conversation.assignee?.name || "Unassigned"}</dd></div></>}
            </dl>
          </section>
          <section>
            <div className="contact-panel__title"><span>TIMELINE</span><button onClick={() => onToast("Full contact timeline opened")}>View all</button></div>
            <ol className="timeline">{isDemo ? <><li><span /><div><strong>Started a chat</strong><time>10:03 today</time></div></li><li><span /><div><strong>Viewed checkout</strong><time>10:02 today</time></div></li><li><span /><div><strong>Conversation resolved</strong><time>02 Aug 2026</time></div></li></> : <>{contactTimeline?.conversations.slice(0, 3).map((item) => <li key={item.id}><span /><div><strong>{item.subject || `${item.channel === "chat" ? "Chat" : "Email"} conversation`}</strong><time>{relativeTime(item.last_message_at || item.created_at)}</time></div></li>)}{contactTimeline?.pageVisits.slice(0, 2).map((visit) => <li key={`${visit.url}-${visit.visited_at}`}><span /><div><strong>Viewed {visit.title || new URL(visit.url).pathname || visit.url}</strong><time>{relativeTime(visit.visited_at)}</time></div></li>)}{!contactTimeline?.conversations.length && !contactTimeline?.pageVisits.length && <li><span /><div><strong>No contact activity yet</strong><time>It will appear here as customers visit and write in.</time></div></li>}</>}</ol>
          </section>
          <section>
            <div className="contact-panel__title"><span>SLA</span></div>
            <div className="sla-card"><span className={`status-chip ${isDemo ? "status-chip--at-risk" : liveSla?.firstResponse.breached || liveSla?.resolution.breached ? "status-chip--breached" : "status-chip--met"}`}>{isDemo ? conversation.sla.label : dueLabel(liveSla)}</span><p>{isDemo ? "First response target: 15 minutes" : liveSla?.firstResponse.dueAt ? `First response ${liveSla.firstResponse.completedAt ? "completed" : "target"}: ${new Date(liveSla.firstResponse.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "Set an SLA policy to track response and resolution targets."}</p></div>
          </section>
        </aside>
      </div>
    </section>
  );
}
