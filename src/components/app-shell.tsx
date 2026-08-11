"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConversationWorkspace } from "@/components/conversation-workspace";
import { HelpCenterSurface, KnowledgeSurface, WidgetDemoSurface } from "@/components/knowledge-and-widget";
import { AnalyticsSurface, SettingsSurface } from "@/components/operations-surfaces";
import { RealtimeBridge } from "@/components/realtime-bridge";
import {
  type ConversationChannel,
  type ConversationStatus,
  type DemoConversation,
  type SlaState,
} from "@/lib/demo-data";

type Screen = "inbox" | "knowledge" | "analytics" | "settings" | "help" | "widget" | "auth";
type SavedView = "all" | "breaching" | "mine" | "unassigned" | "awaiting";
type WorkspaceView = {
  id?: string;
  publicId?: string;
  name: string;
  slug: string;
  appUrl?: string | null;
  inboundEmailDomain?: string | null;
  currentUser: { id: string; name: string; initials: string; role: string; location: string };
  members: Array<{ id: string; name: string; initials: string; role: string; location: string; tone: "current" | "sage" | "sand" | "peach" }>;
};

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

export function AppShell({
  initialWorkspace,
  initialConversations,
  isDemo = false,
}: {
  initialWorkspace: WorkspaceView;
  initialConversations: DemoConversation[];
  isDemo?: boolean;
}) {
  const router = useRouter();
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
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "reconnecting" | "error">("connecting");
  const searchRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState(initialConversations);
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
      .filter((item) => assignee === "all" || (assignee === "me" ? item.assignee?.name === initialWorkspace.currentUser.name : item.assignee === null))
      .filter((item) => {
        if (view === "breaching") return item.sla.state === "breached";
        if (view === "mine") return item.assignee?.name === initialWorkspace.currentUser.name && item.priority === "urgent";
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
  }, [assignee, channel, conversations, initialWorkspace.currentUser.name, query, showEmpty, status, view]);

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

  async function updateConversationStatus(action: "resolve" | "snooze") {
    if (!activeConversation) return;
    const nextStatus: ConversationStatus = action === "resolve" ? "resolved" : "snoozed";
    const label = action === "resolve"
      ? `${activeConversation.subject} resolved`
      : `${activeConversation.subject} snoozed until tomorrow, 09:00`;
    if (!isDemo) {
      try {
        const response = await fetch(`/api/conversations/${activeConversation.id}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action === "resolve"
            ? { action: "resolve" }
            : { action: "snooze", until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }),
        });
        if (!response.ok) throw new Error("Unable to update the conversation.");
      } catch (error) {
        announce(error instanceof Error ? error.message : "Unable to update the conversation.");
        return;
      }
    }
    setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id
      ? { ...conversation, status: nextStatus, unread: false }
      : conversation));
    announce(label);
    setActiveConversationId(null);
  }

  async function assignConversation(conversationId: string, assigneeId: string | null) {
    const member = assigneeId ? initialWorkspace.members.find((item) => item.id === assigneeId) : null;
    if (!isDemo) {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "assign", assigneeId }),
        });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to update the assignee.");
      } catch (error) {
        announce(error instanceof Error ? error.message : "Unable to update the assignee.");
        return false;
      }
    }
    setConversations((current) => current.map((item) => item.id !== conversationId ? item : {
      ...item,
      assigneeId,
      assignee: member ? { name: member.name, initials: member.initials, tone: member.role === "Admin" ? "terracotta" as const : "moss" as const } : null,
    }));
    announce(member ? `Assigned to ${member.name}` : "Conversation is now unassigned");
    return true;
  }

  async function applyBulkAction(action: "assign" | "snooze" | "resolve") {
    if (!selected.length) return;
    const actionPayload = action === "assign"
      ? { action: "assign" as const, assigneeId: initialWorkspace.currentUser.id }
      : action === "snooze"
        ? { action: "snooze" as const, until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
        : { action: "resolve" as const };
    try {
      if (!isDemo) {
        const results = await Promise.all(selected.map(async (conversationId) => {
          const response = await fetch(`/api/conversations/${conversationId}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(actionPayload) });
          const payload = await response.json() as { error?: string };
          if (!response.ok) throw new Error(payload.error ?? "A conversation could not be updated.");
        }));
        void results;
      }
      setConversations((current) => current.map((item) => !selected.includes(item.id) ? item : action === "assign"
        ? { ...item, assigneeId: initialWorkspace.currentUser.id, assignee: { name: initialWorkspace.currentUser.name, initials: initialWorkspace.currentUser.initials, tone: "terracotta" } }
        : { ...item, status: action === "resolve" ? "resolved" : "snoozed", unread: false }));
      const label = action === "assign" ? `assigned to ${initialWorkspace.currentUser.name}` : action === "resolve" ? "resolved" : "snoozed until tomorrow";
      announce(`${selected.length} conversation${selected.length === 1 ? "" : "s"} ${label}.`);
      setSelected([]);
    } catch (error) { announce(error instanceof Error ? error.message : "Conversations could not be updated."); }
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
              onClick={() => item.key === "auth" ? router.push("/login") : changeScreen(item.key)}
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
              onClick={() => item.key === "auth" ? router.push("/login") : changeScreen(item.key)}
            >
              <span className="nav-item__dot" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__profile">
          <div className="avatar avatar--current">{initialWorkspace.currentUser.initials}</div>
          <div>
            <strong>{initialWorkspace.currentUser.name}</strong>
            <span>{initialWorkspace.currentUser.role} · {initialWorkspace.currentUser.location}</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <main className="workspace">
        <div className="realtime-banner" role="status">
          <span className={`realtime-banner__indicator realtime-banner__indicator--${isDemo ? "preview" : realtimeStatus}`} aria-hidden="true" />
          <span>{isDemo ? "Previewing a demo workspace. Sign in to connect live conversations." : realtimeStatus === "connected" ? "Live updates connected. New messages appear automatically." : "Reconnecting to the realtime channel. Replies will deliver automatically."}</span>
          <button onClick={() => announce("Realtime notice dismissed")}>Dismiss</button>
        </div>

        {!isDemo && initialWorkspace.id && <RealtimeBridge workspaceId={initialWorkspace.id} onStatus={setRealtimeStatus} />}

        {screen === "inbox" && activeConversation ? (
          <ConversationWorkspace
            key={activeConversation.id}
            conversation={activeConversation}
            onBack={() => setActiveConversationId(null)}
            onToast={announce}
            onResolve={() => void updateConversationStatus("resolve")}
            onSnooze={() => void updateConversationStatus("snooze")}
            isDemo={isDemo}
            workspaceId={initialWorkspace.id}
            workspaceMembers={initialWorkspace.members}
            currentUser={initialWorkspace.currentUser}
            onAssign={(assigneeId) => assignConversation(activeConversation.id, assigneeId)}
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
                  {isDemo && <DemoBadge />}
                </div>
                <div className="header-actions">
                  {isDemo && <button className="button button--secondary" onClick={() => setShowEmpty((current) => !current)}>
                    {showEmpty ? "Show conversations" : "Preview empty state"}
                  </button>}
                  {!isDemo && <button className="button button--primary" onClick={() => changeScreen("settings")}>Channel setup</button>}
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
                <button onClick={() => void applyBulkAction("assign")}>Assign to me</button>
                <button onClick={() => void applyBulkAction("snooze")}>Snooze</button>
                <button onClick={() => void applyBulkAction("resolve")}>Resolve</button>
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
          <KnowledgeSurface onToast={announce} workspaceId={isDemo ? undefined : initialWorkspace.id} />
        ) : screen === "help" ? (
          <HelpCenterSurface onToast={announce} />
        ) : screen === "widget" ? (
          <WidgetDemoSurface onToast={announce} />
        ) : screen === "analytics" ? (
          <AnalyticsSurface onToast={announce} workspaceId={isDemo ? undefined : initialWorkspace.id} />
        ) : screen === "settings" ? (
          <SettingsSurface onToast={announce} workspaceId={isDemo ? undefined : initialWorkspace.id} workspacePublicId={isDemo ? undefined : initialWorkspace.publicId} workspaceName={initialWorkspace.name} workspaceSlug={initialWorkspace.slug} appUrl={initialWorkspace.appUrl} inboundEmailDomain={initialWorkspace.inboundEmailDomain} members={initialWorkspace.members} />
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
