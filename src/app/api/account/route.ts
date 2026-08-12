import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth";
import { RequestError, toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Permanently removes the authenticated account after guarding shared workspaces. */
export async function DELETE() {
  try {
    const user = await requireAuthenticatedUser();
    const admin = createAdminClient();
    const { data: memberships, error: membershipsError } = await admin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("profile_id", user.id);
    if (membershipsError) throw membershipsError;

    const adminWorkspaceIds = (memberships ?? []).filter((membership) => membership.role === "admin").map((membership) => membership.workspace_id);
    for (const workspaceId of adminWorkspaceIds) {
      const { count, error } = await admin
        .from("workspace_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("role", "admin");
      if (error) throw error;
      if ((count ?? 0) <= 1) {
        throw new RequestError("Transfer admin access to a teammate before deleting this account. Your workspace and customer conversations will remain protected.", 409);
      }
    }

    // Invitations created by this person can reference their profile. Remove
    // those records first so the auth-user deletion remains atomic in intent.
    const { error: invitationsError } = await admin
      .from("workspace_invitations")
      .delete()
      .eq("invited_by", user.id);
    if (invitationsError) throw invitationsError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
