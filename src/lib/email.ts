import { Resend } from "resend";

import { getConversationWorkspace } from "@/lib/conversations";
import { getServerEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueWorkspaceWebhook } from "@/lib/outbound-webhooks";
import { stripUnsafeEmailHtml } from "@/lib/sanitize";

export type InboundEmail = {
  providerEventId: string;
  receivedAt: string;
  from: { email: string; name?: string };
  to: string[];
  subject?: string;
  text: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
};

function normalizeMessageId(value?: string | null) {
  return value?.trim().replace(/^<|>$/g, "") || null;
}

function getResendClient() {
  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY) return null;
  return new Resend(environment.RESEND_API_KEY);
}

function addressLocalPart(address: string) {
  return address.trim().toLowerCase().split("@")[0];
}

async function findWorkspaceForRecipients(recipients: string[]) {
  const admin = createAdminClient();
  const localParts = recipients.map(addressLocalPart);
  const { data: aliases, error: aliasesError } = await admin
    .from("workspaces")
    .select("id")
    .in("support_email_local_part", localParts)
    .limit(2);
  if (aliasesError) throw aliasesError;

  // A workspace slug is also a valid fallback inbox alias. This keeps inboxes
  // reachable while a team is using the default configuration.
  const { data: slugs, error: slugsError } = await admin
    .from("workspaces")
    .select("id")
    .in("slug", localParts)
    .limit(2);
  if (slugsError) throw slugsError;

  const workspaceIds = [...new Set([...(aliases ?? []), ...(slugs ?? [])].map((workspace) => workspace.id))];
  if (workspaceIds.length !== 1) {
    throw new Error("No unique workspace is configured for this receiving address.");
  }
  return { id: workspaceIds[0] };
}

export async function ingestInboundEmail(email: InboundEmail) {
  const admin = createAdminClient();
  const { data: recordedEvent, error: eventError } = await admin
    .from("email_webhook_events")
    .insert({
      provider_event_id: email.providerEventId,
      event_type: "email.received",
      payload: email,
    })
    .select("id")
    .maybeSingle();

  // Unique event IDs make Resend's at-least-once delivery safe to retry.
  if (eventError?.code === "23505") return { duplicate: true };
  if (eventError || !recordedEvent) throw eventError ?? new Error("Unable to store email event.");

  try {
    const workspace = await findWorkspaceForRecipients(email.to);
    const normalizedReferences = [email.inReplyTo, ...(email.references ?? [])]
      .map(normalizeMessageId)
      .filter((value): value is string => Boolean(value));

    let conversationId: string | null = null;
    if (normalizedReferences.length > 0) {
      const { data: threadMessage, error: threadError } = await admin
        .from("messages")
        .select("conversation_id")
        .eq("workspace_id", workspace.id)
        .in("email_message_id", normalizedReferences)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (threadError) throw threadError;
      conversationId = threadMessage?.conversation_id ?? null;
    }

    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .upsert(
        {
          workspace_id: workspace.id,
          email: email.from.email.toLowerCase(),
          name: email.from.name ?? null,
          last_seen_at: email.receivedAt,
        },
        { onConflict: "workspace_id,email" },
      )
      .select("id")
      .single();
    if (contactError) throw contactError;

    if (!conversationId) {
      const { data, error } = await admin
        .from("conversations")
        .insert({
          workspace_id: workspace.id,
          contact_id: contact.id,
          channel: "email",
          subject: email.subject ?? null,
          first_customer_message_at: email.receivedAt,
        })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = data.id;
    }

    const { error: messageError } = await admin.from("messages").insert({
      workspace_id: workspace.id,
      conversation_id: conversationId,
      sender_type: "contact",
      sender_contact_id: contact.id,
      body_text: email.text,
      body_html: email.html ? stripUnsafeEmailHtml(email.html) : null,
      delivery_status: "delivered",
      email_message_id: normalizeMessageId(email.messageId),
      in_reply_to: normalizeMessageId(email.inReplyTo),
      email_references: normalizedReferences,
      sent_at: email.receivedAt,
    });
    if (messageError) throw messageError;

    const { error: conversationError } = await admin
      .from("conversations")
      .update({ status: "open", snoozed_until: null })
      .eq("id", conversationId);
    if (conversationError) throw conversationError;

    await enqueueWorkspaceWebhook({
      workspaceId: workspace.id,
      eventType: "message.created",
      payload: { conversation_id: conversationId, channel: "email", direction: "inbound" },
    });

    await admin
      .from("email_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", recordedEvent.id);

    return { duplicate: false, conversationId };
  } catch (error) {
    await admin
      .from("email_webhook_events")
      .update({ error_message: error instanceof Error ? error.message : "Unknown processing error" })
      .eq("id", recordedEvent.id);
    throw error;
  }
}

export async function sendEmailReply({
  conversationId,
  messageId,
  bodyText,
  bodyHtml,
}: {
  conversationId: string;
  messageId: string;
  bodyText: string;
  bodyHtml?: string;
}) {
  const resend = getResendClient();
  if (!resend) throw new Error("Email sending is not configured.");

  const environment = getServerEnvironment();
  if (!environment.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }

  const admin = createAdminClient();
  const conversation = await getConversationWorkspace(conversationId);
  if (conversation.channel !== "email") throw new Error("This is not an email conversation.");

  const { data: contact, error: contactError } = await admin
    .from("contacts")
    .select("email")
    .eq("id", conversation.contact_id)
    .single();
  if (contactError) throw contactError;
  if (!contact.email) throw new Error("This contact does not have an email address.");

  const { data: latestEmail, error: latestEmailError } = await admin
    .from("messages")
    .select("email_message_id, email_references")
    .eq("conversation_id", conversationId)
    .not("email_message_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestEmailError) throw latestEmailError;

  const replyTo = latestEmail?.email_message_id ?? undefined;
  const references = [
    ...(latestEmail?.email_references ?? []),
    ...(replyTo ? [replyTo] : []),
  ];
  const subject = "Re: " + (await getEmailConversationSubject(conversationId));
  const sendingDomain = environment.RESEND_INBOUND_DOMAIN;
  if (!sendingDomain) {
    throw new Error("RESEND_INBOUND_DOMAIN is not configured for email threading.");
  }
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("slug, support_email_local_part")
    .eq("id", conversation.workspace_id)
    .single();
  if (workspaceError || !workspace) throw workspaceError ?? new Error("Workspace not found.");

  const inboxLocalPart = workspace.support_email_local_part || workspace.slug;
  const replyAddress = `${inboxLocalPart}@${sendingDomain}`;
  const outboundMessageId = `platform-${messageId}@${sendingDomain}`;
  const { data, error } = await resend.emails.send({
    from: environment.RESEND_FROM_EMAIL,
    replyTo: replyAddress,
    to: [contact.email],
    subject,
    text: bodyText,
    html: bodyHtml,
    headers: {
      "Message-ID": `<${outboundMessageId}>`,
      ...(replyTo ? { "In-Reply-To": `<${replyTo}>` } : {}),
      ...(references.length ? { References: references.map((item) => `<${item}>`).join(" ") } : {}),
    },
  });
  if (error || !data) throw error ?? new Error("The email provider did not return a message ID.");

  const { error: updateError } = await admin
    .from("messages")
    .update({
      provider_message_id: data.id,
      email_message_id: outboundMessageId,
      email_references: references,
      delivery_status: "sent",
    })
    .eq("id", messageId)
    .eq("conversation_id", conversationId);
  if (updateError) throw updateError;

  return data;
}

async function getEmailConversationSubject(conversationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversations")
    .select("subject")
    .eq("id", conversationId)
    .single();
  if (error) throw error;
  return data.subject || "Support request";
}
