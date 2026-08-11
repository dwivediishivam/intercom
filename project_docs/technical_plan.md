# Technical Plan

## Chosen stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Application | Next.js + TypeScript | One codebase for dashboard, public help center, widget script endpoints, and server APIs. |
| Hosting | Vercel | Fast deployment, preview deployments, HTTPS, cron support, and custom-domain routing. |
| Database | Supabase PostgreSQL | Relational data model, migrations, row-level security, and strong querying for inboxes/analytics. |
| Authentication | Supabase Auth | Email/password accounts, invitations, session management, and server-side authorization. |
| Real time | Supabase Realtime | WebSocket-driven message updates, typing, presence, read receipts, and inbox refreshes. |
| File storage | Supabase Storage | Article images and future message attachments. |
| Email | Resend | One API for verified-domain sending and inbound email webhooks; its free tier is adequate for test traffic. |
| AI | OpenAI Responses API with a GPT mini/nano text model | Server-only summaries, reply drafts, and article relevance with tightly bounded usage. |
| Optional edge services | Cloudflare | DNS management and free email routing fallback; not the primary email integration. |

Firebase is deliberately not in the first build. Supabase already provides the structured database, authentication, storage, and real-time primitives needed here. Avoiding a second backend reduces delivery risk and operational complexity.

## Architecture

```text
Visitor website
  └─ one-script-tag widget → Next.js widget API + Supabase Realtime

Business dashboard / public help center
  └─ Next.js on Vercel → server routes/actions → Supabase PostgreSQL + Storage
                                              ↘ OpenAI Responses API

Customer email
  └─ Resend inbound webhook → Vercel webhook route → conversation/message records
Agent dashboard reply
  └─ Next.js server route → Resend outbound email → customer inbox
```

All privileged operations run on Next.js server routes/actions. Browser code uses only public configuration and an authenticated session; OpenAI and Resend credentials remain server-side environment variables.

## Core data model

- `workspaces`, `profiles`, `workspace_members`, `workspace_invitations`
- `contacts`, `visitor_sessions`, `page_visits`
- `conversations`, `conversation_participants`, `messages`, `message_reads`, `conversation_snoozes`
- `knowledge_categories`, `knowledge_sections`, `knowledge_articles`
- `canned_responses`, `sla_policies`, `webhook_subscriptions`, `webhook_deliveries`
- `custom_domains`, `ai_summaries`, `ai_usage_events`

Every workspace-owned row contains `workspace_id`. Database row-level security and server-side membership checks enforce that users only access their own workspace.

## Real-time design

1. The widget initializes with a workspace public identifier and creates/restores a random visitor session stored in first-party local storage.
2. A server endpoint validates the site/workspace and issues the narrowly scoped session needed for that visitor’s conversation.
3. New messages are persisted first, then emitted to the relevant conversation channel. The database message ID and creation time establish ordering and allow deduplication after reconnects.
4. Typing, presence, and read receipts are ephemeral real-time events; messages and read state are durable database records.
5. Clients reconnect by fetching messages newer than the latest durable message ID/time before resuming subscriptions.

## Email design

Use Resend as the primary provider:

1. Verify a domain and configure its MX/DKIM/SPF records through Resend.
2. Point Resend inbound-email webhooks to a signed Vercel endpoint.
3. Validate the webhook signature, store the provider event ID to make processing idempotent, then parse sender, recipients, subject, text/HTML, and headers.
4. Match `In-Reply-To` and `References` to an existing outbound/inbound `Message-ID`; otherwise create a new conversation.
5. Send dashboard replies through Resend with an application-generated `Message-ID`, appropriate reply headers, and a monitored sender address.

Cloudflare Email Routing is a useful free fallback for forwarding mail, but it is not sufficient alone because the app also needs programmatic outbound delivery and reliable inbound webhook processing. Resend is the recommended primary choice.

## AI budget controls

- Use a small GPT model with low reasoning effort and JSON-shaped concise output.
- Generate a summary only when an agent opens a conversation or when enough new message content has accumulated; never on every keystroke or message.
- Limit each request to a compact rolling transcript, e.g. the current summary plus the newest relevant messages; cap completion output at roughly 120–180 tokens.
- Cache by the newest message ID. Reuse the previous summary until the cache is stale.
- Retrieve a small number of relevant KB article excerpts before a draft; do not send the whole knowledge base.
- Enforce per-workspace request/token budgets and persist usage metadata. If the API fails or a budget is exhausted, show the prior summary or a clear unavailable state.

## Custom-domain design

The public knowledge base resolves its workspace from the request host. The workspace settings provide a CNAME target and verification status. Vercel will host approved custom domains and provision TLS automatically after DNS validation. The first release will implement the configuration/status workflow and document/manualize the provider-domain registration step; automated provisioning can be added through Vercel’s domain API when a scoped provider token is available.

## Delivery sequence

1. Repository setup, Next.js foundation, environment-template, database schema, Supabase project configuration, and authentication.
2. Workspace membership/RBAC and dashboard/inbox data model.
3. Widget loader, visitor session, durable chat messages, and real-time behavior.
4. Resend inbound webhook, outbound replies, and message threading.
5. Inbox actions, filters, contact timeline, and SLA calculation.
6. Knowledge-base authoring, public search, and widget suggestions.
7. AI summaries and drafts with budget controls.
8. Custom-domain settings, webhooks/API, analytics, production hardening, deployment, and test walkthrough.

## Deployment configuration to collect before implementation

- Supabase project URL, anon key, and server service-role key.
- Resend API key, verified sending/receiving domain, and webhook signing secret.
- OpenAI API key stored only as `OPENAI_API_KEY` on Vercel.
- Vercel project linked to the private GitHub repository.
- A domain for the support address and, ideally, the widget/help-center demo.
