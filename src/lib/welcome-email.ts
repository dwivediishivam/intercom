import { Resend } from "resend";

import { getServerEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function firstName(value?: string | null) {
  const name = value?.trim().split(/\s+/)[0];
  return name ? escapeHtml(name) : "there";
}

function welcomeEmailHtml(name?: string | null) {
  const greeting = firstName(name);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f4ed;color:#13201d;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:38px 16px;background:#f5f4ed;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#fffefa;border:1px solid #d8ddd6;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:34px 37px 12px;">
            <span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:9px 9px 9px 3px;background:#13201d;color:#f5f4ed;font-family:Georgia,serif;font-size:20px;font-weight:700;">i</span>
            <span style="display:inline-block;margin-left:8px;vertical-align:top;padding-top:8px;font-size:15px;font-weight:700;letter-spacing:-.4px;">Intercom</span>
          </td></tr>
          <tr><td style="padding:22px 37px 8px;">
            <p style="margin:0;color:#62816d;font-size:10px;font-weight:700;letter-spacing:1.3px;">WELCOME TO INTERCOM</p>
            <h1 style="margin:15px 0 0;color:#13201d;font-family:Georgia,serif;font-size:39px;font-weight:400;letter-spacing:-1.7px;line-height:1.02;">A calmer home for every customer conversation.</h1>
            <p style="margin:20px 0 0;color:#59665f;font-size:15px;line-height:1.65;">Hi ${greeting},<br /><br />You now have one place to turn chat, email, and customer context into thoughtful next steps. Create your workspace, invite your team, and your inbox is ready to work the way you do.</p>
          </td></tr>
          <tr><td style="padding:22px 37px 34px;">
            <a href="${escapeHtml(getServerEnvironment().NEXT_PUBLIC_APP_URL)}/onboarding" style="display:inline-block;padding:13px 17px;border-radius:999px;background:#13201d;color:#f6f7ef;font-size:13px;font-weight:700;text-decoration:none;">Create your workspace&nbsp; ↗</a>
            <p style="margin:24px 0 0;padding-top:19px;border-top:1px solid #e6e8e1;color:#7b857e;font-size:12px;line-height:1.55;">Tip: once your workspace is ready, open the Widget settings to install the live chat on any website with one script tag.</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;color:#8b958e;font-size:11px;">You received this because a new Intercom account was created with this email address.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Sends one welcome message after a new user first reaches the authenticated
 * product. The profile timestamp makes the operation safe across OAuth and
 * password sign-in flows.
 */
export async function sendWelcomeEmailIfNeeded({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email?: string | null;
  fullName?: string | null;
}) {
  if (!email) return { sent: false, reason: "missing_email" as const };

  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) {
    return { sent: false, reason: "email_not_configured" as const };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, welcome_email_sent_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.welcome_email_sent_at) return { sent: false, reason: "already_sent" as const };

  const resend = new Resend(environment.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: environment.RESEND_FROM_EMAIL,
    to: [email],
    subject: "Welcome to Intercom — your customer inbox is ready",
    html: welcomeEmailHtml(profile?.full_name ?? fullName),
    text: `Hi ${firstName(profile?.full_name ?? fullName)},\n\nWelcome to Intercom. Create your workspace, invite your team, and bring every customer conversation into one focused inbox.\n\nOpen ${environment.NEXT_PUBLIC_APP_URL}/onboarding to get started.`,
  });
  if (error) throw error;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", userId);
  if (updateError) throw updateError;
  return { sent: true as const };
}
