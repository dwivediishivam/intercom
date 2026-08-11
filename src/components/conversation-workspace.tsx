"use client";

import { useRef, useState } from "react";

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

type Props = {
  conversation: DemoConversation;
  onBack: () => void;
  onToast: (message: string) => void;
  onResolve: () => void;
  onSnooze: () => void;
};

export function ConversationWorkspace({ conversation, onBack, onToast, onResolve, onSnooze }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(() => threadByConversation[conversation.id] ?? defaultThread(conversation));
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  function sendMessage() {
    const body = draft.trim();
    if (!body) {
      composerRef.current?.focus();
      return;
    }
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        author: "Aditi Sharma",
        initials: "AS",
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
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    setSummaryLoading(false);
    setSummaryVisible(true);
  }

  async function createDraft() {
    setDraftLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 380));
    setDraftLoading(false);
    setDraft("Thanks for the details, Priya. We’ve identified the payment flow and are checking the final fix now. I’ll send a confirmation as soon as it’s complete—there’s nothing else you need to try at the moment.");
    composerRef.current?.focus();
    onToast("AI reply draft is ready for review");
  }

  function insertCannedReply(text: string) {
    setDraft(text);
    setShowCanned(false);
    composerRef.current?.focus();
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
              <p><strong>Need:</strong> {conversation.name.split(" ")[0]} needs help with {conversation.subject.toLowerCase()}.</p>
              <p><strong>Tried:</strong> Multiple browsers and payment methods; no inline error is shown.</p>
              <p><strong>Now:</strong> Agent is validating the payment flow and will confirm the resolution.</p>
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
                  <div><strong>{message.role === "note" ? "Internal note · Aditi Sharma" : message.author}</strong><time>{message.time}</time></div>
                  <p>{message.body}</p>
                  {message.readBy && <span className="read-receipt">✓ {message.readBy}</span>}
                </div>
              </article>
            ))}
          </div>

          <div className="typing-indicator"><span /><span /><span /> {conversation.name.split(" ")[0]} is typing</div>

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
                    <button onClick={() => insertCannedReply("Thanks for flagging this. I’m looking into it and will share an update shortly.")}>Acknowledgement <span>General</span></button>
                    <button onClick={() => insertCannedReply("I’ve passed this to our billing team. We’ll reissue the corrected invoice within one business day.")}>Billing follow-up <span>Billing</span></button>
                    <button onClick={() => insertCannedReply("Could you share a screen recording and the email address used to sign in? That will help us investigate faster.")}>Ask for details <span>Triage</span></button>
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
              <span>{conversation.location} · Last seen 2m ago</span>
            </div>
          </section>
          <section>
            <div className="contact-panel__title"><span>CONTEXT</span></div>
            <dl className="context-list">
              <div><dt>Plan</dt><dd>Growth · annual</dd></div>
              <div><dt>Owner</dt><dd>Priya Raghavan</dd></div>
              <div><dt>First seen</dt><dd>14 Jan 2026</dd></div>
              <div><dt>Pages viewed</dt><dd>Pricing, Checkout</dd></div>
            </dl>
          </section>
          <section>
            <div className="contact-panel__title"><span>TIMELINE</span><button onClick={() => onToast("Full contact timeline opened")}>View all</button></div>
            <ol className="timeline">
              <li><span /><div><strong>Started a chat</strong><time>10:03 today</time></div></li>
              <li><span /><div><strong>Viewed checkout</strong><time>10:02 today</time></div></li>
              <li><span /><div><strong>Conversation resolved</strong><time>02 Aug 2026</time></div></li>
            </ol>
          </section>
          <section>
            <div className="contact-panel__title"><span>SLA</span></div>
            <div className="sla-card"><span className="status-chip status-chip--at-risk">{conversation.sla.label}</span><p>First response target: 15 minutes</p></div>
          </section>
        </aside>
      </div>
    </section>
  );
}
