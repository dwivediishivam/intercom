"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { ConversationWorkspace } from "@/components/conversation-workspace";
import { HelpCenterSurface, KnowledgeSurface, WidgetDemoSurface } from "@/components/knowledge-and-widget";
import {
  type ConversationChannel,
  type ConversationStatus,
  demoWorkspace,
  type DemoConversation,
  type SlaState,
} from "@/lib/demo-data";

type Screen = "inbox" | "knowledge" | "analytics" | "settings" | "help" | "widget" | "auth";
type SavedView = "all" | "breaching" | "mine" | "unassigned" | "awaiting";

const mainNavigation: Array<{ key: Screen; label: string }> = [
  { key: "inbox", label: "Inbox" },
  { key: "knowledge", label: "Knowledge base" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
];

const publicNavigation: Array<{ key: Screen; label: string }> = [
  { key: "help", label: "Help center" },
  { key: "widget", label: "Widget demo" },
  { key: "auth", label: "Sign in & onboarding" },
];

const savedViews: Array<{ key: SavedView; label: string }> = [
  { key: "all", label: "All conversations" },
  { key: "breaching", label: "Breaching SLA" },
  { key: "mine", label: "Mine · urgent" },
  { key: "unassigned", label: "Unassigned chat" },
  { key: "awaiting", label: "Awaiting customer" },
];

function slaClass(state: SlaState) {
  return `status-chip status-chip--${state}`;
}

function channelLabel(channel: ConversationChannel) {
  return channel === "chat" ? "CHAT" : "EMAIL";
}

function DemoBadge() {
  return <span className="demo-badge">DEMO WORKSPACE</span>;
}

export function AppShell() {
  const [screen, setScreen] = useState<Screen>("inbox");
  const [status, setStatus] = useState<ConversationStatus>("open");
  const [channel, setChannel] = useState<"all" | ConversationChannel>("all");
  const [assignee, setAssignee] = useState<"all" | "me" | "unassigned">("all");
  const [view, setView] = useState<SavedView>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showEmpty, setShowEmpty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const conversations = demoWorkspace.conversations;
  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null;
  const counts = useMemo(
    () => ({
      open: conversations.filter((item) => item.status === "open").length,
      snoozed: conversations.filter((item) => item.status === "snoozed").length,
      resolved: conversations.filter((item) => item.status === "resolved").length,
    }),
    [conversations],
  );

  const filtered = useMemo(() => {
    if (showEmpty) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return conversations
      .filter((item) => item.status === status)
      .filter((item) => channel === "all" || item.channel === channel)
      .filter((item) => assignee === "all" || (assignee === "me" ? item.assignee?.name === "Aditi" : item.assignee === null))
      .filter((item) => {
        if (view === "breaching") return item.sla.state === "breached";
        if (view === "mine") return item.assignee?.name === "Aditi" && item.priority === "urgent";
        if (view === "unassigned") return item.channel === "chat" && item.assignee === null;
        if (view === "awaiting") return item.status === "snoozed";
        return true;
      })
      .filter((item) =>
        !normalizedQuery ||
        [item.name, item.email, item.subject, item.preview, item.tag]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      );
  }, [assignee, channel, conversations, query, showEmpty, status, view]);

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function changeScreen(nextScreen: Screen) {
    setScreen(nextScreen);
    setSidebarOpen(false);
  }

  function toggleSelection(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function announce(message: string) {
    setToast(message);
  }

  function openConversation(conversation: DemoConversation) {
    setActiveConversationId(conversation.id);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, conversation: DemoConversation) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openConversation(conversation);
    }
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
        <span />
        <span />
        <span />
      </button>

      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`} aria-label="Workspace navigation">
        <div className="sidebar__brand-row">
          <div className="brand-mark" aria-hidden="true">I</div>
          <span className="brand-name">Intercom</span>
          <kbd>⌘K</kbd>
          <button className="sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">×</button>
        </div>

        <span className="nav-caption">WORKSPACE</span>
        <nav className="sidebar__nav">
          {mainNavigation.map((item) => (
            <button
              className={`nav-item ${screen === item.key ? "nav-item--active" : ""}`}
              key={item.key}
              onClick={() => changeScreen(item.key)}
            >
              <span className="nav-item__dot" />
              <span>{item.label}</span>
              {item.key === "inbox" && <span className="nav-item__count">{counts.open}</span>}
            </button>
          ))}
        </nav>

        <span className="nav-caption nav-caption--customer">CUSTOMER-FACING</span>
        <nav className="sidebar__nav">
          {publicNavigation.map((item) => (
            <button
              className={`nav-item ${screen === item.key ? "nav-item--active" : ""}`}
              key={item.key}
              onClick={() => changeScreen(item.key)}
            >
              <span className="nav-item__dot" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__profile">
          <div className="avatar avatar--current">{demoWorkspace.currentUser.initials}</div>
          <div>
            <strong>{demoWorkspace.currentUser.name}</strong>
            <span>{demoWorkspace.currentUser.role} · {demoWorkspace.currentUser.location}</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <main className="workspace">
        <div className="realtime-banner" role="status">
          <span className="realtime-banner__spinner" aria-hidden="true" />
          <span>Reconnecting to the realtime channel. Replies will deliver automatically.</span>
          <button onClick={() => announce("Realtime notice dismissed")}>Dismiss</button>
        </div>

        {screen === "inbox" && activeConversation ? (
          <ConversationWorkspace
            key={activeConversation.id}
            conversation={activeConversation}
            onBack={() => setActiveConversationId(null)}
            onToast={announce}
            onResolve={() => { announce(`${activeConversation.subject} resolved`); setActiveConversationId(null); }}
            onSnooze={() => { announce(`${activeConversation.subject} snoozed until tomorrow, 09:00`); setActiveConversationId(null); }}
          />
        ) : screen === "inbox" ? (
          <section className="inbox" aria-label="Unified inbox">
            <header className="inbox__header">
              <div className="page-title-row">
                <div>
                  <div className="page-title-row__heading">
                    <h1>Inbox</h1>
                    <span>{filtered.length} conversation{filtered.length === 1 ? "" : "s"} · {counts.open} open across the team</span>
                  </div>
                  <DemoBadge />
                </div>
                <div className="header-actions">
                  <button className="button button--secondary" onClick={() => setShowEmpty((current) => !current)}>
                    {showEmpty ? "Show conversations" : "Preview empty state"}
                  </button>
                  <button className="button button--primary" onClick={() => announce("New conversation is ready to compose")}>New conversation</button>
                </div>
              </div>

              <div className="inbox-controls">
                <label className="search-field">
                  <span className="search-field__lens" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search conversations, customers, or message text"
                    aria-label="Search conversations"
                  />
                  <kbd>/</kbd>
                </label>

                <div className="segmented-control" aria-label="Conversation status">
                  {(["open", "snoozed", "resolved"] as ConversationStatus[]).map((item) => (
                    <button className={status === item ? "segmented-control__active" : ""} key={item} onClick={() => setStatus(item)}>
                      {item[0].toUpperCase() + item.slice(1)} <span>{counts[item]}</span>
                    </button>
                  ))}
                </div>

                <label className="filter-select">
                  <span>Channel</span>
                  <select value={channel} onChange={(event) => setChannel(event.target.value as "all" | ConversationChannel)}>
                    <option value="all">All</option>
                    <option value="chat">Chat</option>
                    <option value="email">Email</option>
                  </select>
                </label>

                <label className="filter-select">
                  <span>Assignee</span>
                  <select value={assignee} onChange={(event) => setAssignee(event.target.value as "all" | "me" | "unassigned")}>
                    <option value="all">All</option>
                    <option value="me">Me</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </label>
              </div>

              <div className="saved-views" aria-label="Saved inbox views">
                <span>VIEWS</span>
                {savedViews.map((item) => (
                  <button key={item.key} className={view === item.key ? "saved-views__active" : ""} onClick={() => setView(item.key)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </header>

            {selected.length > 0 && (
              <div className="bulk-toolbar" role="status">
                <strong>{selected.length} selected</strong>
                <button onClick={() => announce(`${selected.length} conversations assigned to Aditi`)}>Assign to me</button>
                <button onClick={() => announce(`${selected.length} conversations snoozed until tomorrow 09:00`)}>Snooze</button>
                <button onClick={() => { announce(`${selected.length} conversations resolved`); setSelected([]); }}>Resolve</button>
                <button className="bulk-toolbar__clear" onClick={() => setSelected([])}>Clear</button>
              </div>
            )}

            <div className="conversation-list">
              {filtered.length ? filtered.map((conversation) => (
                <article className={`conversation-row ${conversation.unread ? "conversation-row--unread" : ""}`} key={conversation.id}>
                  <label className="conversation-row__checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(conversation.id)}
                      onChange={() => toggleSelection(conversation.id)}
                      aria-label={`Select ${conversation.subject}`}
                    />
                    <span />
                  </label>
                  <button className="conversation-row__main" onKeyDown={(event) => handleRowKeyDown(event, conversation)} onClick={() => openConversation(conversation)}>
                    <span className={`avatar avatar--${conversation.avatarTone}`}>{conversation.initials}</span>
                    <span className="conversation-row__copy">
                      <span className="conversation-row__meta">
                        <strong>{conversation.name}</strong>
                        <span className="channel-label">{channelLabel(conversation.channel)}</span>
                        {conversation.priority && <span className="priority-label">{conversation.priority}</span>}
                      </span>
                      <span className="conversation-row__subject">{conversation.subject}</span>
                      <span className="conversation-row__preview">{conversation.preview}</span>
                      <span className="conversation-row__footer">
                        {conversation.assignee ? <><span className={`mini-avatar mini-avatar--${conversation.assignee.tone}`}>{conversation.assignee.initials}</span><span>{conversation.assignee.name}</span></> : <><span className="mini-avatar mini-avatar--unassigned">?</span><span>Unassigned</span></>}
                        <span className={slaClass(conversation.sla.state)}>{conversation.sla.label}</span>
                        <span className="tag-chip">{conversation.tag}</span>
                      </span>
                    </span>
                    <time>{conversation.updatedLabel}</time>
                  </button>
                </article>
              )) : (
                <div className="empty-inbox">
                  <div className="empty-inbox__orbit" aria-hidden="true"><span /></div>
                  <h2>{showEmpty ? "Inbox zero, genuinely" : "No conversations match"}</h2>
                  <p>{showEmpty ? "Every conversation is resolved or snoozed. New chats will arrive here immediately." : "Widen the channel or assignee, or clear the search to find more conversations."}</p>
                  <button className="button button--secondary" onClick={() => { setStatus("open"); setChannel("all"); setAssignee("all"); setQuery(""); setView("all"); setShowEmpty(false); }}>Reset filters</button>
                </div>
              )}
            </div>
          </section>
        ) : screen === "knowledge" ? (
          <KnowledgeSurface onToast={announce} />
        ) : screen === "help" ? (
          <HelpCenterSurface onToast={announce} />
        ) : screen === "widget" ? (
          <WidgetDemoSurface onToast={announce} />
        ) : (
          <section className="surface-placeholder">
            <span className="eyebrow">INTERCOM</span>
            <h1>{mainNavigation.concat(publicNavigation).find((item) => item.key === screen)?.label}</h1>
            <p>This surface is being implemented from the supplied reference system. The shared navigation, visual tokens, responsive behavior, and data model are already in place.</p>
            <button className="button button--primary" onClick={() => changeScreen("inbox")}>Return to inbox</button>
          </section>
        )}
      </main>

      {toast && <div className="toast" role="status"><span className="toast__dot" />{toast}<button onClick={() => setToast(null)}>×</button></div>}
    </div>
  );
}
