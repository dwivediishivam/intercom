import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueWorkspaceWebhook } from "@/lib/outbound-webhooks";
import { sanitizeRichText } from "@/lib/sanitize";

export type ConversationAction =
  | { action: "assign"; assigneeId: string | null }
  | { action: "snooze"; until: string }
  | { action: "resolve" }
  | { action: "reopen" };

export async function getConversationWorkspace(conversationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversations")
    .select("id, workspace_id, channel, contact_id, status, first_agent_reply_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Conversation not found.");
  return data;
}

export async function applyConversationAction(
  conversationId: string,
  action: ConversationAction,
  actorProfileId: string,
) {
  const admin = createAdminClient();
  const conversation = await getConversationWorkspace(conversationId);

  const patch =
    action.action === "assign"
      ? { assignee_id: action.assigneeId }
      : action.action === "snooze"
        ? { status: "snoozed", snoozed_until: action.until }
        : action.action === "resolve"
          ? { status: "resolved", snoozed_until: null, resolved_at: new Date().toISOString() }
          : { status: "open", snoozed_until: null, resolved_at: null };

  const { data, error } = await admin
    .from("conversations")
    .update(patch)
    .eq("id", conversationId)
    .select()
    .single();

  if (error) throw error;

  const { error: eventError } = await admin.from("conversation_events").insert({
    workspace_id: conversation.workspace_id,
    conversation_id: conversationId,
    actor_profile_id: actorProfileId,
    event_type: `conversation.${action.action}`,
    payload: action,
  });
  if (eventError) throw eventError;

  await enqueueWorkspaceWebhook({
    workspaceId: conversation.workspace_id,
    eventType: "conversation.updated",
    payload: { conversation_id: conversationId, action: action.action },
  });

  return data;
}

export async function createAgentMessage({
  conversationId,
  actorProfileId,
  bodyText,
  bodyHtml,
  clientMessageId,
}: {
  conversationId: string;
  actorProfileId: string;
  bodyText: string;
  bodyHtml?: string;
  clientMessageId?: string;
}) {
  const admin = createAdminClient();
  const conversation = await getConversationWorkspace(conversationId);
  const sentAt = new Date().toISOString();

  const { data: message, error: messageError } = await admin
    .from("messages")
    .insert({
      workspace_id: conversation.workspace_id,
      conversation_id: conversationId,
      sender_type: "agent",
      sender_profile_id: actorProfileId,
      body_text: bodyText,
      body_html: bodyHtml ? sanitizeRichText(bodyHtml) : null,
      client_message_id: clientMessageId ?? null,
      delivery_status: conversation.channel === "email" ? "pending" : "sent",
      sent_at: sentAt,
    })
    .select()
    .single();

  if (messageError) throw messageError;

  const { error: conversationError } = await admin
    .from("conversations")
    .update({
      status: "open",
      snoozed_until: null,
      first_agent_reply_at: conversation.first_agent_reply_at ?? sentAt,
      last_message_at: sentAt,
      last_message_preview: bodyText.slice(0, 280),
    })
    .eq("id", conversationId);
  if (conversationError) throw conversationError;

  await enqueueWorkspaceWebhook({
    workspaceId: conversation.workspace_id,
    eventType: "message.created",
    payload: { conversation_id: conversationId, message_id: message.id, channel: conversation.channel },
  });

  return { conversation, message };
}

export async function listConversationMessages(conversationId: string, limit = 100) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data;
}
