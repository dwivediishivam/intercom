# Customer Communication Platform — Project Brief

## Product

Build a secure, multi-tenant customer communication platform for businesses. Teams use one workspace to support customers through website chat and email, publish self-service help content, and use AI assistance to work faster.

## Required capabilities

### Workspace and team administration

- Email/password sign-up and login.
- Workspace creation and membership management.
- Invitation flow for team members.
- Server-enforced roles: Admin and Agent.
- Conversation assignment and reassignment.

### Embedded live chat

- A standalone JavaScript widget installable on any site with one script tag.
- Real-time visitor and agent messaging.
- Typing indicators, availability status, and read receipts.
- Persistent visitor identity and chat history across return visits.
- Suggested help articles while a visitor types.

### Email support

- A support address that accepts incoming customer email into the inbox.
- Dashboard replies delivered as ordinary email.
- Reliable conversation threading using message identifiers and reply headers.
- Safe, idempotent webhook processing for duplicate deliveries.

### Unified inbox and customer context

- One inbox for chat and email conversations.
- Filters by channel, assignee, and state: Open, Snoozed, Resolved.
- Snooze and resolve workflows.
- Contact timeline with previous conversations, recent pages, and last-seen data.
- SLA targets for first response and resolution, including breach indicators.

### Knowledge base

- Rich-text article creation, editing, publishing, and unpublishing.
- Categories and sections.
- Public, searchable knowledge-base experience.
- Workspace-specific help-center configuration.

### AI assistance

- Concise conversation summary that captures customer need, actions already tried, and current status.
- Summary refresh as new messages arrive.
- Reply draft suggestions grounded in conversation context and relevant help articles.
- Bounded context, strict output limits, caching, failure fallback, and usage logging.

### Extensibility and reporting

- Tagged canned responses that agents can insert into replies.
- Configurable event webhooks.
- REST API for programmatic access.
- Analytics for response and resolution times, busiest hours, and agent performance.

### Domains and security

- Workspace custom domains for the public knowledge base.
- DNS verification workflow and managed TLS/SSL approach.
- Tenant isolation, authorization checks, validation/sanitization, rate limiting, and audit-friendly logs.

## Acceptance paths

1. A new user can sign up, create a workspace, and invite another teammate.
2. A visitor can use a live demo site’s installed widget and communicate with an assigned agent in real time.
3. An email to the configured support address appears in the inbox; a dashboard reply reaches the sender and later replies remain in the same conversation.
4. A published article is searchable publicly and is suggested in the widget.
5. A long conversation has a useful AI summary and an optional AI reply draft without exposing secrets or consuming excessive tokens.
6. Workspace boundaries remain enforced across all dashboard, widget, API, and webhook paths.

