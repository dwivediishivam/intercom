-- Customer communication platform: initial multi-tenant data model.
-- Application writes go through authenticated server routes using the service role.
-- Browser clients have read-only, membership-scoped access; widget access goes through
-- narrowly scoped server endpoints so visitor sessions cannot access other tenants.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.workspace_role as enum ('admin', 'agent');
create type public.conversation_channel as enum ('chat', 'email');
create type public.conversation_status as enum ('open', 'snoozed', 'resolved');
create type public.message_sender_type as enum ('contact', 'agent', 'system', 'ai');
create type public.message_delivery_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');
create type public.article_status as enum ('draft', 'published', 'archived');
create type public.domain_status as enum ('pending_dns', 'verified', 'provisioning_tls', 'active', 'failed');
create type public.webhook_delivery_status as enum ('pending', 'delivered', 'failed', 'retrying');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  support_email_local_part citext,
  widget_site_origins text[] not null default '{}',
  brand_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspaces_support_email_local_part_unique
  on public.workspaces (support_email_local_part)
  where support_email_local_part is not null;

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email citext not null,
  role public.workspace_role not null default 'agent',
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email citext,
  name text,
  avatar_url text,
  external_id text,
  attributes jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contacts_workspace_email_unique
  on public.contacts (workspace_id, email) where email is not null;
create unique index contacts_workspace_external_id_unique
  on public.contacts (workspace_id, external_id) where external_id is not null;

create table public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  token_hash text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.contact_page_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  visitor_session_id uuid references public.visitor_sessions(id) on delete set null,
  url text not null,
  title text,
  referrer text,
  visited_at timestamptz not null default now()
);

create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  first_response_target_minutes integer not null default 240 check (first_response_target_minutes > 0),
  resolution_target_minutes integer not null default 1440 check (resolution_target_minutes > 0),
  business_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  visitor_session_id uuid references public.visitor_sessions(id) on delete set null,
  channel public.conversation_channel not null,
  status public.conversation_status not null default 'open',
  subject text,
  assignee_id uuid references public.profiles(id) on delete set null,
  priority smallint not null default 0 check (priority between -2 and 2),
  snoozed_until timestamptz,
  first_customer_message_at timestamptz,
  first_agent_reply_at timestamptz,
  resolved_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  message_count integer not null default 0 check (message_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'snoozed') = (snoozed_until is not null))
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type public.message_sender_type not null,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_contact_id uuid references public.contacts(id) on delete set null,
  body_text text not null default '',
  body_html text,
  delivery_status public.message_delivery_status not null default 'pending',
  client_message_id uuid,
  provider_message_id text,
  email_message_id text,
  in_reply_to text,
  email_references text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (sender_type = 'contact' and sender_contact_id is not null and sender_profile_id is null)
    or (sender_type in ('agent', 'ai') and sender_profile_id is not null and sender_contact_id is null)
    or (sender_type = 'system' and sender_profile_id is null and sender_contact_id is null)
  ),
  unique (conversation_id, client_message_id),
  unique (workspace_id, email_message_id),
  unique (workspace_id, provider_message_id)
);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  created_at timestamptz not null default now()
);

create table public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

create table public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) <= 100),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug citext not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.knowledge_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.knowledge_categories(id) on delete cascade,
  name text not null,
  slug citext not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  section_id uuid not null references public.knowledge_sections(id) on delete restrict,
  title text not null,
  slug citext not null,
  excerpt text,
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_html, '')), 'C')
  ) stored,
  status public.article_status not null default 'draft',
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug),
  check ((status = 'published') = (published_at is not null))
);

create table public.canned_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_summaries (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  summary text not null,
  source_last_message_id uuid references public.messages(id) on delete set null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12, 8),
  created_at timestamptz not null default now()
);

create table public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hostname citext not null unique,
  verification_token text not null unique,
  status public.domain_status not null default 'pending_dns',
  provider_domain_id text,
  verification_checked_at timestamptz,
  tls_issued_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  secret_hash text not null,
  secret_ciphertext text not null,
  event_types text[] not null check (cardinality(event_types) > 0),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status public.webhook_delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  response_code integer,
  last_error text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create table public.rate_limit_buckets (
  bucket_key text primary key,
  hits integer not null default 0 check (hits >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_workspace_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric_date date not null,
  channel public.conversation_channel,
  agent_id uuid references public.profiles(id) on delete set null,
  conversations_opened integer not null default 0,
  conversations_resolved integer not null default 0,
  first_response_seconds bigint,
  resolution_seconds bigint,
  sla_breaches integer not null default 0,
  unique nulls not distinct (workspace_id, metric_date, channel, agent_id)
);

create index conversations_inbox_idx on public.conversations (workspace_id, status, last_message_at desc);
create index conversations_assignee_idx on public.conversations (workspace_id, assignee_id, status, last_message_at desc);
create index messages_conversation_idx on public.messages (conversation_id, sent_at, id);
create index messages_reply_idx on public.messages (workspace_id, in_reply_to) where in_reply_to is not null;
create index page_visits_contact_idx on public.contact_page_visits (workspace_id, contact_id, visited_at desc);
create index articles_search_idx on public.knowledge_articles using gin (search_document);
create index articles_public_idx on public.knowledge_articles (workspace_id, status, published_at desc);
create index ai_usage_workspace_idx on public.ai_usage_events (workspace_id, created_at desc);
create index webhook_deliveries_retry_idx on public.webhook_deliveries (status, next_attempt_at) where status in ('pending', 'retrying');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.assert_message_tenant_integrity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conversation_workspace_id uuid;
begin
  select workspace_id into conversation_workspace_id
  from public.conversations
  where id = new.conversation_id;

  if conversation_workspace_id is null or conversation_workspace_id <> new.workspace_id then
    raise exception 'Message and conversation must belong to the same workspace';
  end if;
  return new;
end;
$$;

create or replace function public.update_conversation_after_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
  set
    message_count = message_count + 1,
    last_message_at = new.sent_at,
    last_message_preview = left(new.body_text, 280),
    first_customer_message_at = case
      when new.sender_type = 'contact' then coalesce(first_customer_message_at, new.sent_at)
      else first_customer_message_at
    end,
    first_agent_reply_at = case
      when new.sender_type in ('agent', 'ai') then coalesce(first_agent_reply_at, new.sent_at)
      else first_agent_reply_at
    end,
    status = case when new.sender_type = 'contact' then 'open' else status end,
    snoozed_until = case when new.sender_type = 'contact' then null else snoozed_until end
  where id = new.conversation_id;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and profile_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and profile_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_workspace_with_owner(
  workspace_name text,
  workspace_slug citext
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.workspaces (name, slug)
  values (workspace_name, workspace_slug)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (new_workspace_id, auth.uid(), 'admin');

  insert into public.sla_policies (workspace_id)
  values (new_workspace_id);

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace_with_owner(text, citext) to authenticated;

create or replace function public.consume_rate_limit(
  target_bucket_key text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  bucket public.rate_limit_buckets%rowtype;
begin
  if max_hits < 1 or window_seconds < 1 then
    raise exception 'Rate-limit parameters must be positive';
  end if;

  insert into public.rate_limit_buckets (bucket_key, hits)
  values (target_bucket_key, 1)
  on conflict (bucket_key) do nothing;

  select * into bucket
  from public.rate_limit_buckets
  where bucket_key = target_bucket_key
  for update;

  if bucket.window_started_at + make_interval(secs => window_seconds) <= now() then
    update public.rate_limit_buckets
    set hits = 1, window_started_at = now(), updated_at = now()
    where bucket_key = target_bucket_key;
    return true;
  end if;

  if bucket.hits >= max_hits then
    return false;
  end if;

  update public.rate_limit_buckets
  set hits = hits + 1, updated_at = now()
  where bucket_key = target_bucket_key;
  return true;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute procedure public.set_updated_at();

create trigger workspace_members_set_updated_at before update on public.workspace_members
  for each row execute procedure public.set_updated_at();

create trigger contacts_set_updated_at before update on public.contacts
  for each row execute procedure public.set_updated_at();

create trigger sla_policies_set_updated_at before update on public.sla_policies
  for each row execute procedure public.set_updated_at();

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute procedure public.set_updated_at();

create trigger messages_assert_tenant_integrity before insert on public.messages
  for each row execute procedure public.assert_message_tenant_integrity();

create trigger messages_update_conversation after insert on public.messages
  for each row execute procedure public.update_conversation_after_message();

create trigger knowledge_categories_set_updated_at before update on public.knowledge_categories
  for each row execute procedure public.set_updated_at();

create trigger knowledge_sections_set_updated_at before update on public.knowledge_sections
  for each row execute procedure public.set_updated_at();

create trigger knowledge_articles_set_updated_at before update on public.knowledge_articles
  for each row execute procedure public.set_updated_at();

create trigger canned_responses_set_updated_at before update on public.canned_responses
  for each row execute procedure public.set_updated_at();

create trigger ai_summaries_set_updated_at before update on public.ai_summaries
  for each row execute procedure public.set_updated_at();

create trigger custom_domains_set_updated_at before update on public.custom_domains
  for each row execute procedure public.set_updated_at();

create trigger webhook_subscriptions_set_updated_at before update on public.webhook_subscriptions
  for each row execute procedure public.set_updated_at();

create trigger webhook_deliveries_set_updated_at before update on public.webhook_deliveries
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.contacts enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.contact_page_visits enable row level security;
alter table public.sla_policies enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_reads enable row level security;
alter table public.conversation_events enable row level security;
alter table public.knowledge_categories enable row level security;
alter table public.knowledge_sections enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.canned_responses enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.custom_domains enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.api_tokens enable row level security;
alter table public.email_webhook_events enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.daily_workspace_metrics enable row level security;

create policy "profiles are visible to their owner"
  on public.profiles for select to authenticated using (id = auth.uid());

create policy "profiles are editable by their owner"
  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members can read their workspace"
  on public.workspaces for select to authenticated using (public.is_workspace_member(id));

create policy "members can read workspace members"
  on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read workspace invitations"
  on public.workspace_invitations for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read contacts"
  on public.contacts for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read visitor sessions"
  on public.visitor_sessions for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read page visits"
  on public.contact_page_visits for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read sla policies"
  on public.sla_policies for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read conversations"
  on public.conversations for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read messages"
  on public.messages for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read attachments"
  on public.message_attachments for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read message reads"
  on public.message_reads for select to authenticated using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_workspace_member(m.workspace_id)
    )
  );

create policy "members can read conversation events"
  on public.conversation_events for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read knowledge categories"
  on public.knowledge_categories for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read knowledge sections"
  on public.knowledge_sections for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read knowledge articles"
  on public.knowledge_articles for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read canned responses"
  on public.canned_responses for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members can read ai summaries"
  on public.ai_summaries for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "admins can read ai usage"
  on public.ai_usage_events for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']::public.workspace_role[]));

create policy "members can read custom domains"
  on public.custom_domains for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "admins can read webhook subscriptions"
  on public.webhook_subscriptions for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']::public.workspace_role[]));

create policy "admins can read webhook deliveries"
  on public.webhook_deliveries for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']::public.workspace_role[]));

create policy "admins can read api tokens"
  on public.api_tokens for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']::public.workspace_role[]));

create policy "admins can read metrics"
  on public.daily_workspace_metrics for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']::public.workspace_role[]));

-- No client-side write policies are defined. Mutations are performed by validated
-- server routes with the service role, which must apply role checks explicitly.

-- Realtime uses durable records for message/read state and ephemeral broadcast
-- channels for typing/presence. The subscription client still needs a scoped
-- authenticated session; public visitors only receive short-lived widget sessions.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.message_reads;
