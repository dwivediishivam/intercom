"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Notice = (message: string) => void;

type Article = {
  id: string;
  sectionId?: string;
  title: string;
  excerpt: string;
  category: string;
  section: string;
  status: "Published" | "Draft";
  updated: string;
  contentHtml?: string;
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

type KnowledgeSnapshot = {
  categories: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; category_id: string; name: string }>;
  articles: Array<{ id: string; section_id: string; title: string; excerpt: string | null; content_html: string; status: "draft" | "published" | "archived"; updated_at: string }>;
};

function articleSlug(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || "article";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function KnowledgeSurface({ onToast, workspaceId }: { onToast: Notice; workspaceId?: string }) {
  const isLive = Boolean(workspaceId);
  const [articles, setArticles] = useState<Article[]>(() => isLive ? [] : initialArticles);
  const [collections, setCollections] = useState<KnowledgeSnapshot["categories"]>([]);
  const [sections, setSections] = useState<KnowledgeSnapshot["sections"]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Article["status"]>("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftCollectionId, setDraftCollectionId] = useState("");
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    void fetch(`/api/workspaces/${workspaceId}/knowledge`)
      .then(async (response) => {
        const payload = await response.json() as KnowledgeSnapshot & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Knowledge base could not be loaded.");
        if (!active) return;
        const categoryById = new Map(payload.categories.map((category) => [category.id, category.name]));
        const sectionById = new Map(payload.sections.map((section) => [section.id, section]));
        setCollections(payload.categories);
        setSections(payload.sections);
        setArticles(payload.articles.filter((article) => article.status !== "archived").map((article) => {
          const section = sectionById.get(article.section_id);
          return {
            id: article.id,
            sectionId: article.section_id,
            title: article.title,
            excerpt: article.excerpt ?? "",
            category: section ? categoryById.get(section.category_id) ?? "Knowledge base" : "Knowledge base",
            section: section?.name ?? "Unsorted",
            status: article.status === "published" ? "Published" : "Draft",
            updated: new Date(article.updated_at).toLocaleDateString([], { month: "short", day: "numeric" }),
            contentHtml: article.content_html,
          };
        }));
      })
      .catch((error: unknown) => { if (active) onToast(error instanceof Error ? error.message : "Knowledge base could not be loaded."); });
    return () => { active = false; };
  }, [onToast, workspaceId]);

  const filtered = useMemo(() => articles.filter((article) => (
    (status === "All" || article.status === status) &&
    [article.title, article.excerpt, article.category].join(" ").toLowerCase().includes(query.toLowerCase())
  )), [articles, query, status]);

  async function publishArticle() {
    const title = draftTitle.trim();
    if (!title) {
      onToast("Add a title before publishing");
      return;
    }
    if (!isLive) {
      setArticles((current) => [{ id: `kb-${Date.now()}`, title, excerpt: draftBody.trim() || "A new help article for your customers.", category: "Getting started", section: "Workspace basics", status: "Published", updated: "Just now" }, ...current]);
      setDraftTitle("");
      setDraftBody("");
      setEditorOpen(false);
      onToast("Article published to your help center");
      return;
    }
    const existingArticle = editingArticleId ? articles.find((article) => article.id === editingArticleId) : null;
    const selectedCollectionId = draftCollectionId || (existingArticle?.sectionId ? sections.find((section) => section.id === existingArticle.sectionId)?.category_id : undefined) || collections[0]?.id;
    const sectionId = existingArticle?.sectionId || sections.find((section) => section.category_id === selectedCollectionId)?.id;
    if (!selectedCollectionId || !sectionId || !workspaceId) { onToast("Choose a collection before publishing this article."); return; }
    try {
      const body = draftBody.trim() || "A new help article for your customers.";
      const richHtml = editorRef.current?.innerHTML.trim() || `<p>${escapeHtml(body).replace(/\n/g, "<br />")}</p>`;
      const payload = { sectionId, title, slug: articleSlug(title), excerpt: body.slice(0, 600), contentJson: { type: "doc", content: [] }, contentHtml: richHtml, status: "published" };
      const response = await fetch(editingArticleId ? `/api/workspaces/${workspaceId}/knowledge/articles/${editingArticleId}` : `/api/workspaces/${workspaceId}/knowledge/articles`, { method: editingArticleId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { article?: { id: string; section_id: string; title: string; excerpt: string | null; status: "published" | "draft"; updated_at: string }; error?: string };
      if (!response.ok || !result.article) throw new Error(result.error ?? "Article could not be published.");
      const section = sections.find((item) => item.id === result.article?.section_id);
      const category = collections.find((item) => item.id === section?.category_id);
      const saved: Article = { id: result.article.id, sectionId: result.article.section_id, title: result.article.title, excerpt: result.article.excerpt ?? body.slice(0, 600), category: category?.name ?? "Knowledge base", section: "", status: result.article.status === "published" ? "Published" : "Draft", updated: "Just now" };
      setArticles((current) => editingArticleId ? current.map((article) => article.id === editingArticleId ? saved : article) : [saved, ...current]);
      setDraftTitle(""); setDraftBody(""); setDraftCollectionId(""); setEditingArticleId(null); setEditorOpen(false);
      onToast("Article published to your help center");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Article could not be published.");
    }
  }

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = collectionName.trim();
    if (!name) { onToast("Name the collection first."); return; }
    if (!workspaceId) { onToast("Collections are available in a signed-in workspace."); return; }
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/knowledge/categories`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, slug: articleSlug(name), position: collections.length }) });
      const payload = await response.json() as { category?: KnowledgeSnapshot["categories"][number]; defaultSection?: KnowledgeSnapshot["sections"][number]; error?: string };
      if (!response.ok || !payload.category) throw new Error(payload.error ?? "Collection could not be created.");
      setCollections((current) => [...current, payload.category!]);
      if (payload.defaultSection) setSections((current) => [...current, payload.defaultSection!]);
      setDraftCollectionId(payload.category.id);
      setCollectionName(""); setCollectionOpen(false);
      onToast("Knowledge collection created.");
    } catch (error) { onToast(error instanceof Error ? error.message : "Collection could not be created."); }
  }

  function formatEditor(command: "bold" | "italic" | "insertUnorderedList") {
    editorRef.current?.focus();
    document.execCommand(command);
    setDraftBody(editorRef.current?.innerText ?? "");
  }

  const collectionItems = isLive
    ? collections.map((category) => {
      const categorySections = sections.filter((section) => section.category_id === category.id);
      const count = articles.filter((article) => categorySections.some((section) => section.id === article.sectionId)).length;
      return [category.name, "", `${count} article${count === 1 ? "" : "s"}`];
    })
    : categories;

  return (
    <section className="content-surface knowledge-surface" aria-label="Knowledge base management">
      <header className="content-header">
        <div><span className="eyebrow">KNOWLEDGE BASE</span><h1>Help your customers help themselves.</h1><p>Publish clear answers in simple collections, then let the chat widget suggest the right one before a ticket starts.</p></div>
        <button className="button button--primary" onClick={() => { setEditingArticleId(null); setDraftTitle(""); setDraftBody(""); setDraftCollectionId(collections[0]?.id ?? ""); setEditorOpen(true); }}>Create article</button>
      </header>

      <div className="knowledge-layout">
        <aside className="knowledge-tree">
          <div className="panel-caption"><span>COLLECTION</span><button onClick={() => setCollectionOpen(true)}>Manage</button></div>
          {collectionItems.map(([category, _section, count]) => <div className="knowledge-tree__item" key={category}><strong>{category}</strong><small>{count}</small></div>)}
          <button className="add-link" onClick={() => setCollectionOpen(true)}>+ Add collection</button>
        </aside>
        <div className="knowledge-content">
          <div className="knowledge-content__tools"><label className="search-field"><span className="search-field__lens" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles" aria-label="Search articles" /></label><div className="compact-tabs">{(["All", "Published", "Draft"] as const).map((item) => <button className={status === item ? "compact-tabs__active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div></div>
          <div className="article-table" role="table" aria-label="Knowledge base articles">
            <div className="article-table__head" role="row"><span>ARTICLE</span><span>COLLECTION</span><span>STATUS</span><span>UPDATED</span></div>
            {filtered.map((article) => <button className="article-table__row" role="row" key={article.id} onClick={() => { const collectionId = sections.find((section) => section.id === article.sectionId)?.category_id ?? ""; setEditingArticleId(article.id); setDraftTitle(article.title); setDraftBody(article.contentHtml?.replace(/<[^>]+>/g, " ") || article.excerpt); setDraftCollectionId(collectionId); setEditorOpen(true); }}><span><strong>{article.title}</strong><small>{article.excerpt}</small></span><span>{article.category}</span><span><i className={article.status === "Published" ? "article-status article-status--published" : "article-status"}>{article.status}</i></span><time>{article.updated}</time></button>)}
          </div>
        </div>
      </div>

      {editorOpen && <div className="modal-backdrop" role="presentation"><section className="article-editor" role="dialog" aria-modal="true" aria-label="Article editor"><header><div><span className="eyebrow">ARTICLE EDITOR</span><h2>{editingArticleId ? "Edit article" : "Create article"}</h2></div><button className="modal-close" onClick={() => setEditorOpen(false)} aria-label="Close article editor">×</button></header><label>Collection<select value={draftCollectionId} onChange={(event) => setDraftCollectionId(event.target.value)}><option value="">Choose a collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>{!collections.length && <button className="add-link" onClick={() => setCollectionOpen(true)}>+ Create a collection</button>}<label>Title<input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="A clear, searchable question" autoFocus /></label><label>Article content<div className="rich-editor"><div className="rich-editor__toolbar"><button type="button" onClick={() => formatEditor("bold")} aria-label="Bold text"><b>B</b></button><button type="button" onClick={() => formatEditor("italic")} aria-label="Italic text"><i>I</i></button><button type="button" onClick={() => formatEditor("insertUnorderedList")} aria-label="Bullet list">• List</button></div><div ref={editorRef} className="rich-editor__canvas" contentEditable suppressContentEditableWarning onInput={(event) => setDraftBody(event.currentTarget.innerText)} data-placeholder="Write the answer your customer needs…">{draftBody}</div></div></label><div className="article-editor__meta"><span>{collections.find((collection) => collection.id === draftCollectionId)?.name ?? "Choose where this article belongs"}</span><span>Formatting is saved as safe HTML.</span></div><footer><button className="button button--secondary" onClick={() => { setEditorOpen(false); onToast("Draft kept open in this session"); }}>Save draft</button><button className="button button--primary" onClick={publishArticle}>Publish article</button></footer></section></div>}
      {collectionOpen && <div className="modal-backdrop"><form className="invite-modal" onSubmit={createCollection}><header><div><span className="eyebrow">KNOWLEDGE BASE</span><h2>New collection</h2></div><button type="button" className="modal-close" onClick={() => setCollectionOpen(false)}>×</button></header><label>Collection name<input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Getting started" autoFocus /></label><footer><button type="button" className="button button--secondary" onClick={() => setCollectionOpen(false)}>Cancel</button><button className="button button--primary">Create collection</button></footer></form></div>}
    </section>
  );
}

type PublicCategory = { name: string; slug: string; sections?: Array<{ name: string; articles?: Array<{ id: string; title: string; slug: string; excerpt?: string | null }> }> };

function flattenPublicCategories(categories: PublicCategory[]): Article[] {
  return categories.flatMap((category) => (
    (category.sections ?? []).flatMap((section) => (
      (section.articles ?? []).map((article) => ({
        id: article.id,
        title: article.title,
        excerpt: article.excerpt ?? "",
        category: category.name,
        section: section.name,
        status: "Published" as const,
        updated: "",
      }))
    ))
  ));
}

export function HelpCenterSurface({ onToast, live = false }: { onToast: Notice; live?: boolean }) {
  const [query, setQuery] = useState("");
  const [remoteArticles, setRemoteArticles] = useState<Article[]>([]);
  const [remoteCategories, setRemoteCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!live) return;
    let active = true;
    const suffix = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : "";
    void fetch(`/api/public/knowledge${suffix}`)
      .then(async (response) => {
        const payload = await response.json() as { categories?: PublicCategory[]; articles?: Array<{ id: string; title: string; slug: string; excerpt?: string | null }>; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Knowledge base could not be loaded.");
        if (!active) return;
        if (payload.categories) {
          setRemoteCategories(payload.categories);
          setRemoteArticles(flattenPublicCategories(payload.categories));
        } else {
          setRemoteArticles((payload.articles ?? []).map((article) => ({ id: article.id, title: article.title, excerpt: article.excerpt ?? "", category: "Help center", section: "Search result", status: "Published" as const, updated: "" })));
        }
      })
      .catch((error: unknown) => { if (active) onToast(error instanceof Error ? error.message : "Knowledge base could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [live, onToast, query]);

  const articles = live
    ? remoteArticles
    : initialArticles.filter((article) => [article.title, article.excerpt, article.category].join(" ").toLowerCase().includes(query.toLowerCase()));
  const topicItems = live
    ? remoteCategories.map((category) => [category.name, category.sections?.[0]?.name ?? "Help articles", `${category.sections?.flatMap((section) => section.articles ?? []).length ?? 0} articles`])
    : categories;
  function updateQuery(nextQuery: string) {
    if (live) setLoading(true);
    setQuery(nextQuery);
  }
  return (
    <section className="help-center" aria-label="Public help center preview">
      <header className="help-center__hero"><div className="help-center__nav"><span className="help-center__brand"><i>i</i> Intercom</span><a href="#contact" onClick={(event) => { event.preventDefault(); onToast("Chat with support is ready from the widget") }}>Contact support</a></div><div className="help-center__intro"><span className="eyebrow">SUPPORT CENTER</span><h1>How can we help?</h1><label className="help-search"><span className="search-field__lens" /><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search for answers" aria-label="Search the help center" /></label></div></header>
      <div className="help-center__body"><span className="eyebrow">BROWSE BY TOPIC</span><div className="help-topics">{topicItems.map(([name, section, count]) => <button key={name} onClick={() => updateQuery(name)}><i>{name[0]}</i><strong>{name}</strong><span>{section} · {count}</span><b>→</b></button>)}</div><div className="help-results"><div><h2>{query ? "Search results" : "Popular answers"}</h2><span>{loading ? "Searching…" : `${articles.length} article${articles.length === 1 ? "" : "s"}`}</span></div>{articles.map((article) => <button key={article.id} onClick={() => onToast(`${article.title} opened`)}><span>{article.category}</span><strong>{article.title}</strong><p>{article.excerpt}</p><b>Read article →</b></button>)}{live && !loading && articles.length === 0 && <p className="help-results__empty">There are no published articles here yet.</p>}</div></div>
      <footer className="help-center__footer"><span>Still need a hand?</span><button onClick={() => onToast("Open the widget at bottom-right to chat with us")}>Start a conversation</button></footer>
    </section>
  );
}
