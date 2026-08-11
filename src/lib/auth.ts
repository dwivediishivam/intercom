import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WorkspaceRole = "admin" | "agent";

export class AuthenticationError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this workspace.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthenticationError();
  }

  return user;
}

export async function requireWorkspaceMembership(
  workspaceId: string,
  allowedRoles?: WorkspaceRole[],
) {
  const user = await requireAuthenticatedUser();
  const admin = createAdminClient();
  const { data: membership, error } = await admin
    .from("workspace_members")
    .select("workspace_id, profile_id, role")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error || !membership) {
    throw new AuthorizationError();
  }

  if (allowedRoles && !allowedRoles.includes(membership.role as WorkspaceRole)) {
    throw new AuthorizationError("Your role cannot perform this action.");
  }

  return { user, membership: membership as { workspace_id: string; profile_id: string; role: WorkspaceRole } };
}
