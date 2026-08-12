"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const capabilityGroups = [
  {
    eyebrow: "ONE PLACE TO RESPOND",
    title: "Every customer signal, shaped into a next step.",
    copy: "Live chat and email arrive in the same calm, accountable inbox. Route work to the right person, protect focus with snooze, and keep the full customer story close by.",
    points: ["Real-time chat, typing, presence, and read receipts", "Threaded email with normal reply behaviour", "Assignments, SLAs, saved replies, and contact history"],
  },
  {
    eyebrow: "KNOWLEDGE THAT HELPS",
    title: "Answers that travel farther than your team can.",
    copy: "Publish a searchable help centre, surface the most relevant answer while someone types, and keep every article organised for the people who need it.",
    points: ["Rich articles, categories, publishing, and search", "In-widget article suggestions", "A hosted help centre on your own domain"],
  },
  {
    eyebrow: "INTELLIGENCE, WITH RESTRAINT",
    title: "Useful context—not another stream of noise.",
    copy: "Intercom turns long threads into a concise brief, drafts a considered first response, and makes the operational picture easy to scan without replacing human judgement.",
    points: ["Conversation summaries that update with the thread", "AI-assisted reply drafts grounded in context", "Analytics, webhooks, API tokens, and delivery visibility"],
  },
];

const inboxRows = [
  { name: "Riya Kapoor", channel: "CHAT", detail: "Can I change the billing contact?", state: "Needs a reply", tone: "peach" },
  { name: "Aarav Menon", channel: "EMAIL", detail: "Re: Exporting our members", state: "Assigned to you", tone: "blue" },
  { name: "Meera Shah", channel: "CHAT", detail: "The invite link has expired", state: "2 min ago", tone: "lavender" },
];

export function MarketingLanding({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const router = useRouter();
  const [activeCapability, setActiveCapability] = useState(0);
  const [pointer, setPointer] = useState({ x: 55, y: 24 });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      setPointer({
        x: Math.round((event.clientX / window.innerWidth) * 100),
        y: Math.round((event.clientY / window.innerHeight) * 100),
      });
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  const active = capabilityGroups[activeCapability];

  async function signOut() {
    const { error } = await createBrowserSupabaseClient().auth.signOut();
    if (!error) {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <main className="landing" style={{ "--cursor-x": `${pointer.x}%`, "--cursor-y": `${pointer.y}%` } as CSSProperties}>
      <div className="landing__grain" aria-hidden="true" />
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="landing-brand" href="/"><span>i</span>Intercom</Link>
        <button className="landing-nav__menu" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><i /><i /></button>
        <div className={`landing-nav__links ${menuOpen ? "landing-nav__links--open" : ""}`}>
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
          <a href="#channels" onClick={() => setMenuOpen(false)}>Channels</a>
          <a href="#operations" onClick={() => setMenuOpen(false)}>Operations</a>
          {isAuthenticated ? <><a className="landing-nav__login" href="/app">Dashboard</a><button className="landing-nav__logout" onClick={() => void signOut()}>Sign out</button></> : <><a className="landing-nav__login" href="/login">Sign in</a><a className="landing-nav__cta" href="/login?mode=signup">Start building</a></>}
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <div className="landing-eyebrow"><span className="landing-eyebrow__pulse" />CUSTOMER COMMUNICATION, CLARIFIED</div>
          <h1>Make every<br /><em>customer moment</em><br />feel considered.</h1>
          <p>Intercom gives focused teams one intelligent home for conversations, knowledge, and the next thoughtful action.</p>
          <div className="landing-hero__actions">
            <a className="landing-button landing-button--primary" href={isAuthenticated ? "/app" : "/login?mode=signup"}>{isAuthenticated ? "Open your dashboard" : "Create your workspace"} <b>↗</b></a>
            <a className="landing-button landing-button--quiet" href="/demo">Try the live widget <b>↓</b></a>
          </div>
          <div className="landing-hero__proof"><span><strong>2 channels</strong>One shared inbox</span><span><strong>Real time</strong>From visitor to teammate</span><span><strong>AI-assisted</strong>When context matters</span></div>
        </div>

        <div className="landing-stage" aria-label="A preview of the Intercom inbox">
          <div className="landing-stage__halo landing-stage__halo--one" />
          <div className="landing-stage__halo landing-stage__halo--two" />
          <article className="landing-inbox-card">
            <header><div className="landing-inbox-card__brand"><span>i</span><b>Intercom</b></div><div className="landing-inbox-card__live"><i />Live updates</div><button aria-label="More inbox options">•••</button></header>
            <div className="landing-inbox-card__body">
              <aside><b>INBOX</b><span className="landing-inbox-card__active">All conversations <i>8</i></span><span>Assigned to me <i>3</i></span><span>Unassigned <i>2</i></span><b>VIEWS</b><span>Needs attention</span><span>Waiting on customer</span></aside>
              <section>
                <div className="landing-inbox-card__title"><div><small>INBOX</small><strong>Good afternoon, Shivam.</strong></div><button>+ New</button></div>
                <div className="landing-inbox-card__filters"><span>Open <b>8</b></span><span>All channels⌄</span><span>Search conversations</span></div>
                <div className="landing-inbox-card__rows">
                  {inboxRows.map((row, index) => <div className="landing-inbox-row" key={row.name} style={{ animationDelay: `${index * 110}ms` }}><i className={`landing-avatar landing-avatar--${row.tone}`}>{row.name.slice(0, 1)}</i><div><b>{row.name} <small>{row.channel}</small></b><span>{row.detail}</span></div><em>{row.state}</em></div>)}
                </div>
              </section>
            </div>
            <div className="landing-inbox-card__note"><span><i />Riya is typing…</span><b>Ask AI to summarise ↗</b></div>
          </article>
          <div className="landing-floating-card landing-floating-card--summary"><span>✦</span><div><small>THREAD BRIEF</small><b>Billing contact change</b><p>Riya needs a new owner assigned before Friday’s renewal.</p></div></div>
          <div className="landing-floating-card landing-floating-card--widget"><div className="landing-floating-card__dots"><i /><i /><i /></div><p>“I can help with that.”</p><span>Customer chat · now</span></div>
        </div>
      </section>

      <section className="landing-marquee" aria-label="Product capabilities"><div><span>LIVE CHAT</span><i>✦</i><span>THREADED EMAIL</span><i>✦</i><span>KNOWLEDGE BASE</span><i>✦</i><span>AI BRIEFS</span><i>✦</i><span>REAL-TIME INBOX</span><i>✦</i><span>LIVE CHAT</span><i>✦</i><span>THREADED EMAIL</span></div></section>

      <section className="landing-capabilities" id="product">
        <div className="landing-section-heading"><span>01 — THE PRODUCT</span><h2>One steady surface<br />for the work that<br /><em>moves a customer forward.</em></h2></div>
        <div className="landing-capability-grid">
          <div className="landing-capability-tabs" role="tablist" aria-label="Product capabilities">
            {capabilityGroups.map((item, index) => <button className={activeCapability === index ? "is-active" : ""} key={item.eyebrow} onClick={() => setActiveCapability(index)} role="tab" aria-selected={activeCapability === index}><span>0{index + 1}</span><b>{item.eyebrow}</b><i>↘</i></button>)}
          </div>
          <article className="landing-capability-card" key={active.eyebrow}>
            <div className={`landing-capability-card__visual landing-capability-card__visual--${activeCapability}`}>
              {activeCapability === 0 && <><div className="signal signal--chat">New chat <b>Riya Kapoor</b></div><div className="signal signal--mail">New email <b>Export request</b></div><div className="signal signal--route">Assigned to you <b>Just now</b></div></>}
              {activeCapability === 1 && <><div className="article-window"><small>HELP CENTRE</small><b>Change an account owner</b><span>4 min read · Published</span><i /><i /><i /></div><div className="article-suggestion">↗ Suggested in chat</div></>}
              {activeCapability === 2 && <><div className="ai-orbit">✦</div><div className="ai-brief"><small>CONVERSATION BRIEF</small><b>What they need</b><p>Move billing ownership and retain historical invoices.</p><span>Draft a reply →</span></div></>}
            </div>
            <div className="landing-capability-card__copy"><span>{active.eyebrow}</span><h3>{active.title}</h3><p>{active.copy}</p><ul>{active.points.map((point) => <li key={point}><i>✓</i>{point}</li>)}</ul></div>
          </article>
        </div>
      </section>

      <section className="landing-channels" id="channels"><div className="landing-section-heading"><span>02 — CHANNELS</span><h2>Meet customers<br />where they already are.</h2><p>A lightweight widget for any site. An inbox that treats email like email. Both arrive with the context your team needs.</p></div><div className="landing-channel-grid"><article><span className="landing-channel-grid__number">01</span><div className="landing-channel-grid__chat"><small>Message us</small><p>Hi there — how can we help?</p><div><i />I have a question about my team plan.</div><em>Knowledge suggestions appear as they type.</em></div><h3>Live chat that remembers.</h3><p>Install with one script tag. Visitors return to the same conversation, while your team sees their complete history.</p><a href="/demo">Open the widget demo ↗</a></article><article><span className="landing-channel-grid__number">02</span><div className="landing-channel-grid__mail"><div><i>←</i><b>Re: Exporting members</b><i>⋯</i></div><p>Hi Aarav,<br /><br />I’ve prepared the export and added the columns you requested.<br /><br />— Shivam</p><span>Delivered · Thread preserved</span></div><h3>Email, without the blind spots.</h3><p>Incoming mail lands beside chat. Replies keep Message-ID headers and customers receive a normal, familiar email.</p><a href="/login?mode=signup">Set up a workspace ↗</a></article></div></section>

      <section className="landing-operations" id="operations"><div className="landing-operations__intro"><span>03 — THE OPERATING LAYER</span><h2>Designed for the things you should never have to chase.</h2><p>Make ownership visible. Keep a pulse on service quality. Connect the rest of your stack when a conversation becomes more than a conversation.</p></div><div className="landing-operations__grid"><article><span>↗</span><b>Team ownership</b><p>Invite admins and agents, assign work, and make hand-offs explicit.</p></article><article><span>◷</span><b>SLA awareness</b><p>Track first responses and resolutions before a customer has to ask.</p></article><article><span>⌘</span><b>Developer-ready</b><p>Webhook delivery, encrypted secrets, API tokens, and domain controls.</p></article><article><span>⌁</span><b>Contact context</b><p>See their past conversations, last seen activity, and the path that led here.</p></article></div></section>

      <section className="landing-close"><div className="landing-close__glow" /><span>YOUR NEXT CONVERSATION STARTS HERE</span><h2>Build the kind of<br />support people <em>remember.</em></h2><p>{isAuthenticated ? "Your workspace is ready. Return to the inbox, test the live widget, or keep shaping the support experience." : "Create a workspace, invite your team, and turn a blank inbox into a customer operation that feels remarkably human."}</p><a className="landing-button landing-button--primary" href={isAuthenticated ? "/app" : "/login?mode=signup"}>{isAuthenticated ? "Open your dashboard" : "Create your workspace"} <b>↗</b></a></section>
      <footer className="landing-footer"><Link className="landing-brand" href="/"><span>i</span>Intercom</Link><div>{isAuthenticated ? <><a href="/app">Dashboard</a><button onClick={() => void signOut()}>Sign out</button></> : <a href="/login">Sign in</a>}<a href="/demo">Widget demo</a><a href="/help">Help centre</a></div><small>Built for teams who care about the details.</small></footer>
    </main>
  );
}
