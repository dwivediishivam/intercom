-- A workspace slug is globally unique and makes a predictable, tenant-safe
-- default email alias such as acme@inbound.example.com.
update public.workspaces
set support_email_local_part = slug
where support_email_local_part is null;

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

  insert into public.workspaces (name, slug, support_email_local_part)
  values (workspace_name, workspace_slug, workspace_slug)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (new_workspace_id, auth.uid(), 'admin');

  insert into public.sla_policies (workspace_id)
  values (new_workspace_id);

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace_with_owner(text, citext) to authenticated;
