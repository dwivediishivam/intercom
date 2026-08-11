import { createHash, randomBytes } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/env";
import { Resend } from "resend";

export async function createWorkspaceForCurrentUser({
  name,
  slug,
}: {
  name: string;
  slug: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_workspace_with_owner", {
    workspace_name: name,
    workspace_slug: slug,
  });
  if (error) throw error;
  return data as string;
}

export async function createWorkspaceInvitation({
  workspaceId,
  email,
  role,
  invitedBy,
}: {
  workspaceId: string;
  email: string;
  role: "admin" | "agent";
  invitedBy: string;
}) {
  const plaintextToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(plaintextToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_invitations")
    .upsert(
      {
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        role,
        token_hash: tokenHash,
        invited_by: invitedBy,
        accepted_at: null,
        expires_at: expiresAt,
      },
      { onConflict: "workspace_id,email" },
    )
    .select("id, email, role, expires_at")
    .single();
  if (error) throw error;

  // The caller sends the full URL through the email provider. The raw token is
  // intentionally never persisted in the database.
  return { invitation: data, token: plaintextToken };
}

export async function acceptWorkspaceInvitation({
  token,
  profileId,
  email,
}: {
  token: string;
  profileId: string;
  email: string;
}) {
  const admin = createAdminClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: invitation, error } = await admin
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, accepted_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!invitation || invitation.accepted_at || new Date(invitation.expires_at) < new Date()) {
    throw new Error("This invitation is invalid or expired.");
  }
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Sign in with the email address that received the invitation.");
  }

  const { error: membershipError } = await admin.from("workspace_members").upsert({
    workspace_id: invitation.workspace_id,
    profile_id: profileId,
    role: invitation.role,
  });
  if (membershipError) throw membershipError;

  const { error: invitationError } = await admin
    .from("workspace_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);
  if (invitationError) throw invitationError;
  return invitation.workspace_id;
}

export async function sendWorkspaceInvitationEmail({
  recipient,
  workspaceName,
  token,
}: {
  recipient: string;
  workspaceName: string;
  token: string;
}) {
  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) {
    throw new Error("Email sending is not configured for invitations.");
  }

  const invitationUrl = new URL("/invite", environment.NEXT_PUBLIC_APP_URL);
  invitationUrl.searchParams.set("token", token);
  const resend = new Resend(environment.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: environment.RESEND_FROM_EMAIL,
    to: [recipient],
    subject: `Join ${workspaceName}`,
    text: `You have been invited to join ${workspaceName}. Accept the invitation: ${invitationUrl.toString()}`,
  });
  if (error) throw error;
}
