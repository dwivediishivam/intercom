import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitationSchema, uuidSchema } from "@/lib/validation";
import { createWorkspaceInvitation, sendWorkspaceInvitationEmail } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("workspace_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ invitations: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    const input = invitationSchema.parse(await request.json());
    const { user } = await requireWorkspaceMembership(workspaceId, ["admin"]);
    const result = await createWorkspaceInvitation({
      workspaceId,
      invitedBy: user.id,
      ...input,
    });
    const admin = createAdminClient();
    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();
    if (workspaceError) throw workspaceError;

    try {
      await sendWorkspaceInvitationEmail({
        recipient: input.email,
        workspaceName: workspace.name,
        token: result.token,
      });
      return NextResponse.json({ invitation: result.invitation, emailDelivered: true }, { status: 201 });
    } catch (emailError) {
      // The invitation remains securely stored and can be resent once a mail
      // provider is configured. A provider outage must not misrepresent a
      // successful email delivery to the workspace admin.
      console.error("Workspace invitation email could not be delivered", emailError);
      return NextResponse.json({
        invitation: result.invitation,
        emailDelivered: false,
        warning: "The invitation was created, but email delivery is not configured yet.",
      }, { status: 201 });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
