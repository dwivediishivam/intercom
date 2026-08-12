import { createHash, randomBytes } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/env";
import { Resend } from "resend";

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

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
  const safeWorkspaceName = escapeEmailHtml(workspaceName);
  const safeRecipient = escapeEmailHtml(recipient);
  const resend = new Resend(environment.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${workspaceName} team <${environment.RESEND_FROM_EMAIL}>`,
    to: [recipient],
    subject: `Join ${workspaceName}`,
    text: `You have been invited to join ${workspaceName}.\n\nAccept your secure invitation: ${invitationUrl.toString()}\n\nThis link is for ${recipient} and expires in 7 days.\n\n— The ${workspaceName} team`,
    html: `<div style="margin:0;padding:36px 20px;background:#f7f5f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;overflow:hidden;border:1px solid #e0ddd7;border-radius:12px;background:#fff"><tr><td style="padding:24px 28px;background:#1d1d1b;color:#fff"><div style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:7px;background:#c05a37;text-align:center;font-family:Georgia,serif;font-weight:700">i</div><span style="margin-left:8px;font-weight:700">Intercom</span></td></tr><tr><td style="padding:32px 28px"><p style="margin:0;color:#a65033;font-size:11px;font-weight:800;letter-spacing:.1em">WORKSPACE INVITATION</p><h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;letter-spacing:-.04em">Join ${safeWorkspaceName}.</h1><p style="margin:18px 0;color:#5f5c56;font-size:15px;line-height:1.6">You have been invited to collaborate with the ${safeWorkspaceName} team in their shared customer inbox.</p><p style="margin:24px 0"><a href="${invitationUrl.toString()}" style="display:inline-block;padding:12px 17px;border-radius:7px;color:#fff;background:#1d1d1b;font-size:14px;font-weight:700;text-decoration:none">Accept invitation →</a></p><p style="margin:0;color:#7a766f;font-size:12px;line-height:1.55">This secure link is for ${safeRecipient} and expires in 7 days. If you were not expecting this invitation, you can safely ignore this email.</p></td></tr><tr><td style="padding:16px 28px;border-top:1px solid #ece9e3;color:#858078;font-size:11px">Sent by the ${safeWorkspaceName} team through Intercom.</td></tr></table></td></tr></table></div>`,
  });
  if (error) throw error;
}
