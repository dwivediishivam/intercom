"use client";

import { useMemo, useState } from "react";

type Notice = (message: string) => void;

type Article = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  section: string;
  status: "Published" | "Draft";
  updated: string;
};

const initialArticles: Article[] = [
  { id: "kb-1", title: "Get your team set up in Intercom", excerpt: "Invite teammates, give the right roles, and organise your shared inbox.", category: "Getting started", section: "Workspace basics", status: "Published", updated: "Today" },
  { id: "kb-2", title: "Update your billing details", excerpt: "Change your billing contact, payment method, and tax information securely.", category: "Billing", section: "Plans and invoices", status: "Published", updated: "Yesterday" },
  { id: "kb-3", title: "Install the chat widget", excerpt: "Add a lightweight script tag to start talking with visitors on any website.", category: "Getting started", section: "Workspace basics", status: "Published", updated: "06 Aug" },
  { id: "kb-4", title: "Configure SSO for your company", excerpt: "Set up sign-in protections and manage the verified domains for your team.", category: "Security", section: "Access and identity", status: "Draft", updated: "05 Aug" },
];

const categories = [
  ["Getting started", "Workspace basics", "3 articles"],
  ["Billing", "Plans and invoices", "1 article"],
  ["Security", "Access and identity", "1 article"],
];

export function KnowledgeSurface({ onToast }: { onToast: Notice }) {
  const [articles, setArticles] = useState(initialArticles);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Article["status"]>("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const filtered = useMemo(() => articles.filter((article) => (
    (status === "All" || article.status === status) &&
    [article.title, article.excerpt, article.category].join(" ").toLowerCase().includes(query.toLowerCase())
  )), [articles, query, status]);

  function publishArticle() {
    const title = draftTitle.trim();
    if (!title) {
      onToast("Add a title before publishing");
      return;
    }
    setArticles((current) => [{ id: `kb-${Date.now()}`, title, excerpt: draftBody.trim() || "A new help article for your customers.", category: "Getting started", section: "Workspace basics", status: "Published", updated: "Just now" }, ...current]);
    setDraftTitle("");
    setDraftBody("");
    setEditorOpen(false);
    onToast("Article published to your help center");
  }

  return (
    <section className="content-surface knowledge-surface" aria-label="Knowledge base management">
      <header className="content-header">
        <div><span className="eyebrow">KNOWLEDGE BASE</span><h1>Help your customers help themselves.</h1><p>Publish clear answers, organise them into sections, and let the chat widget suggest the right one before a ticket starts.</p></div>
        <button className="button button--primary" onClick={() => setEditorOpen(true)}>Create article</button>
      </header>

      <div className="knowledge-layout">
        <aside className="knowledge-tree">
          <div className="panel-caption"><span>COLLECTION</span><button onClick={() => onToast("Category editor opened")}>Manage</button></div>
          {categories.map(([category, section, count]) => <div className="knowledge-tree__item" key={category}><strong>{category}</strong><span>{section}</span><small>{count}</small></div>)}
          <button className="add-link" onClick={() => onToast("New category form opened")}>+ Add category</button>
        </aside>
        <div className="knowledge-content">
          <div className="knowledge-content__tools"><label className="search-field"><span className="search-field__lens" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles" aria-label="Search articles" /></label><div className="compact-tabs">{(["All", "Published", "Draft"] as const).map((item) => <button className={status === item ? "compact-tabs__active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div></div>
          <div className="article-table" role="table" aria-label="Knowledge base articles">
            <div className="article-table__head" role="row"><span>ARTICLE</span><span>SECTION</span><span>STATUS</span><span>UPDATED</span></div>
            {filtered.map((article) => <button className="article-table__row" role="row" key={article.id} onClick={() => { setDraftTitle(article.title); setDraftBody(article.excerpt); setEditorOpen(true); }}><span><strong>{article.title}</strong><small>{article.excerpt}</small></span><span>{article.category}<small>{article.section}</small></span><span><i className={article.status === "Published" ? "article-status article-status--published" : "article-status"}>{article.status}</i></span><time>{article.updated}</time></button>)}
          </div>
        </div>
      </div>

      {editorOpen && <div className="modal-backdrop" role="presentation"><section className="article-editor" role="dialog" aria-modal="true" aria-label="Article editor"><header><div><span className="eyebrow">ARTICLE EDITOR</span><h2>{draftTitle ? "Edit article" : "Create article"}</h2></div><button className="modal-close" onClick={() => setEditorOpen(false)} aria-label="Close article editor">×</button></header><label>Title<input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="A clear, searchable question" autoFocus /></label><label>Article content<textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} placeholder="Write the answer your customer needs…" /></label><div className="article-editor__meta"><span>Getting started / Workspace basics</span><span>Rich-text controls connect here</span></div><footer><button className="button button--secondary" onClick={() => { setEditorOpen(false); onToast("Draft saved locally"); }}>Save draft</button><button className="button button--primary" onClick={publishArticle}>Publish article</button></footer></section></div>}
    </section>
  );
}

export function HelpCenterSurface({ onToast }: { onToast: Notice }) {
  const [query, setQuery] = useState("");
  const articles = initialArticles.filter((article) => [article.title, article.excerpt, article.category].join(" ").toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="help-center" aria-label="Public help center preview">
      <header className="help-center__hero"><div className="help-center__nav"><span className="help-center__brand"><i>i</i> Intercom</span><a href="#contact" onClick={(event) => { event.preventDefault(); onToast("Chat with support is ready from the widget") }}>Contact support</a></div><div className="help-center__intro"><span className="eyebrow">SUPPORT CENTER</span><h1>How can we help?</h1><label className="help-search"><span className="search-field__lens" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for answers" aria-label="Search the help center" /></label></div></header>
      <div className="help-center__body"><span className="eyebrow">BROWSE BY TOPIC</span><div className="help-topics">{categories.map(([name, section, count]) => <button key={name} onClick={() => setQuery(name)}><i>{name[0]}</i><strong>{name}</strong><span>{section} · {count}</span><b>→</b></button>)}</div><div className="help-results"><div><h2>{query ? "Search results" : "Popular answers"}</h2><span>{articles.length} article{articles.length === 1 ? "" : "s"}</span></div>{articles.map((article) => <button key={article.id} onClick={() => onToast(`${article.title} opened`)}><span>{article.category}</span><strong>{article.title}</strong><p>{article.excerpt}</p><b>Read article →</b></button>)}</div></div>
      <footer className="help-center__footer"><span>Still need a hand?</span><button onClick={() => onToast("Open the widget at bottom-right to chat with us")}>Start a conversation</button></footer>
    </section>
  );
}

export function WidgetDemoSurface({ onToast }: { onToast: Notice }) {
  const [opened, setOpened] = useState(true);
  const [visitorMessage, setVisitorMessage] = useState("");
  const [messages, setMessages] = useState([{ from: "agent", text: "Hi! I’m here to help you find an answer or connect with our team." }]);
  const showSuggestions = visitorMessage.trim().length > 2;
  function send() {
    if (!visitorMessage.trim()) return;
    setMessages((current) => [...current, { from: "visitor", text: visitorMessage.trim() }]);
    setVisitorMessage("");
    onToast("Demo chat message added. The deployed widget will deliver this to the unified inbox.");
  }
  return (
    <section className="widget-demo" aria-label="Embeddable chat widget demo">
      <header className="content-header"><div><span className="eyebrow">CUSTOMER-FACING</span><h1>One script. A real conversation.</h1><p>Preview the persistent live chat widget exactly as a visitor sees it. It suggests knowledge before creating a conversation for your team.</p></div><button className="button button--secondary" onClick={() => onToast("Widget installation instructions copied")}>Copy install snippet</button></header>
      <div className="widget-demo__stage"><div className="demo-site"><nav><span>Papertrail</span><a>Features</a><a>Pricing</a><button>Start free</button></nav><main><span className="eyebrow">PAPERTRAIL FOR TEAMS</span><h2>A calmer way to build together.</h2><p>See the visitor experience without leaving your Intercom workspace.</p><button>Explore the product</button></main><code>{`<script async src="https://your-app.vercel.app/widget.js" data-workspace="..." />`}</code></div>{opened && <section className="chat-widget"><header><div><i>i</i><div><strong>Intercom support</strong><span><b /> Typically replies in minutes</span></div></div><button onClick={() => setOpened(false)} aria-label="Minimize chat">−</button></header><div className="chat-widget__messages">{messages.map((message, index) => <p className={`chat-bubble chat-bubble--${message.from}`} key={`${message.text}-${index}`}>{message.text}</p>)}{showSuggestions && <div className="widget-suggestions"><span>HELPFUL ARTICLES</span><button onClick={() => onToast("Suggested article opened")}>Update your billing details <b>→</b></button><button onClick={() => onToast("Suggested article opened")}>Get your team set up <b>→</b></button></div>}</div><div className="chat-widget__composer"><input value={visitorMessage} onChange={(event) => setVisitorMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} placeholder="Write a message…" aria-label="Chat message" /><button onClick={send} aria-label="Send chat message">↑</button></div><footer>Powered by Intercom <span>·</span> <button onClick={() => onToast("Privacy details opened")}>Privacy</button></footer></section>}{!opened && <button className="widget-launcher" onClick={() => setOpened(true)} aria-label="Open Intercom support">i<span /></button>}</div>
    </section>
  );
}
