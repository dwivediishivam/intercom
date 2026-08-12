import { createHash, randomBytes } from "node:crypto";

import { getPublicEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueWorkspaceWebhook } from "@/lib/outbound-webhooks";

function hashVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newVisitorToken() {
  return randomBytes(32).toString("base64url");
}

function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

export function assertWidgetOrigin(
  configuredOrigins: string[],
  requestOrigin: string | null,
) {
  if (!requestOrigin) return;

  const origin = normalizeOrigin(requestOrigin);
  const applicationOrigin = normalizeOrigin(getPublicEnvironment().NEXT_PUBLIC_APP_URL);
  const allowedOrigins = new Set([...configuredOrigins.map(normalizeOrigin), applicationOrigin]);

  if (!allowedOrigins.has(origin)) {
    throw new Error("This origin is not allowed to load the widget.");
  }
}

export async function bootstrapVisitor({
  workspacePublicId,
  visitorToken,
  requestOrigin,
  page,
}: {
  workspacePublicId: string;
  visitorToken?: string;
  requestOrigin: string | null;
  page?: { url: string; title?: string; referrer?: string };
}) {
  const admin = createAdminClient();
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, public_id, name, widget_site_origins")
    .eq("public_id", workspacePublicId)
    .maybeSingle();

  if (workspaceError) throw workspaceError;
  if (!workspace) throw new Error("Widget workspace was not found.");
  assertWidgetOrigin(workspace.widget_site_origins ?? [], requestOrigin);

  let token = visitorToken;
  let session: { id: string; contact_id: string | null; expires_at: string | null } | null = null;

  if (token) {
    const { data, error } = await admin
      .from("visitor_sessions")
      .select("id, contact_id, expires_at")
      .eq("workspace_id", workspace.id)
      .eq("token_hash", hashVisitorToken(token))
      .maybeSingle();
    if (error) throw error;
    session = data && (!data.expires_at || new Date(data.expires_at) > new Date()) ? data : null;
  }

  if (!session) {
    token = newVisitorToken();
    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .insert({ workspace_id: workspace.id, name: "Website visitor" })
      .select("id")
      .single();
    if (contactError) throw contactError;

    const { data, error } = await admin
      .from("visitor_sessions")
      .insert({
        workspace_id: workspace.id,
        contact_id: contact.id,
        token_hash: hashVisitorToken(token),
      })
      .select("id, contact_id, expires_at")
      .single();
    if (error) throw error;
    session = data;
  }

  const now = new Date().toISOString();
  await admin
    .from("visitor_sessions")
    .update({ last_seen_at: now })
    .eq("id", session.id);
  await admin.from("contacts").update({ last_seen_at: now }).eq("id", session.contact_id);

  if (page && session.contact_id) {
    await admin.from("contact_page_visits").insert({
      workspace_id: workspace.id,
      contact_id: session.contact_id,
      visitor_session_id: session.id,
      ...page,
    });
  }

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id, status, last_message_at")
    .eq("workspace_id", workspace.id)
    .eq("visitor_session_id", session.id)
    .eq("channel", "chat")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (conversationError) throw conversationError;

  const { data: messages, error: messagesError } = conversation
    ? await admin
        .from("messages")
        .select("id, sender_type, body_text, sent_at, delivery_status")
        .eq("conversation_id", conversation.id)
        .order("sent_at", { ascending: true })
        .limit(100)
    : { data: [], error: null };
  if (messagesError) throw messagesError;

  // The visitor has this chat open, so agent chat messages are now read. This
  // drives a durable receipt in the inbox without relying on client memory.
  if (conversation) {
    const { error: readError } = await admin
      .from("messages")
      .update({ delivery_status: "read" })
      .eq("conversation_id", conversation.id)
      .eq("sender_type", "agent")
      .in("delivery_status", ["pending", "sent", "delivered"]);
    if (readError) throw readError;
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    visitorToken: token,
    visitorSessionId: session.id,
    contactId: session.contact_id,
    conversation,
    messages: messages ?? [],
  };
}

export async function sendVisitorMessage({
  workspacePublicId,
  visitorToken,
  conversationId,
  bodyText,
  clientMessageId,
  requestOrigin,
}: {
  workspacePublicId: string;
  visitorToken: string;
  conversationId?: string;
  bodyText: string;
  clientMessageId: string;
  requestOrigin: string | null;
}) {
  const visitor = await bootstrapVisitor({
    workspacePublicId,
    visitorToken,
    requestOrigin,
  });
  const admin = createAdminClient();
  const sentAt = new Date().toISOString();
  if (!visitor.contactId) throw new Error("Visitor session is missing its contact record.");
  let activeConversationId = conversationId ?? visitor.conversation?.id;

  if (activeConversationId) {
    const { data, error } = await admin
      .from("conversations")
      .select("id")
      .eq("id", activeConversationId)
      .eq("workspace_id", visitor.workspaceId)
      .eq("visitor_session_id", visitor.visitorSessionId)
      .eq("channel", "chat")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Conversation was not found for this visitor.");
  } else {
    const { data, error } = await admin
      .from("conversations")
      .insert({
        workspace_id: visitor.workspaceId,
        contact_id: visitor.contactId,
        visitor_session_id: visitor.visitorSessionId,
        channel: "chat",
        first_customer_message_at: sentAt,
      })
      .select("id")
      .single();
    if (error) throw error;
    activeConversationId = data.id;
  }

  const { data: message, error: messageError } = await admin
    .from("messages")
    .insert({
      workspace_id: visitor.workspaceId,
      conversation_id: activeConversationId,
      sender_type: "contact",
      sender_contact_id: visitor.contactId,
      body_text: bodyText,
      client_message_id: clientMessageId,
      delivery_status: "sent",
      sent_at: sentAt,
    })
    .select()
    .single();
  if (messageError) throw messageError;

  const { error: conversationError } = await admin
    .from("conversations")
    .update({ status: "open", snoozed_until: null })
    .eq("id", activeConversationId);
  if (conversationError) throw conversationError;

  await enqueueWorkspaceWebhook({
    workspaceId: visitor.workspaceId,
    eventType: "message.created",
    payload: { conversation_id: activeConversationId, message_id: message.id, channel: "chat" },
  });

  return { conversationId: activeConversationId, message, visitorToken: visitor.visitorToken };
}

/** Stores a short-lived typing marker with the visitor session. Durable messages remain the source of truth. */
export async function setVisitorTyping({
  workspacePublicId,
  visitorToken,
  conversationId,
  typing,
  requestOrigin,
}: {
  workspacePublicId: string;
  visitorToken: string;
  conversationId?: string;
  typing: boolean;
  requestOrigin: string | null;
}) {
  const visitor = await bootstrapVisitor({ workspacePublicId, visitorToken, requestOrigin });
  if (!visitor.conversation?.id || (conversationId && conversationId !== visitor.conversation.id)) {
    return { active: false };
  }
  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("visitor_sessions")
    .select("metadata")
    .eq("id", visitor.visitorSessionId)
    .single();
  if (sessionError) throw sessionError;
  const metadata = (session.metadata && typeof session.metadata === "object" ? session.metadata : {}) as Record<string, unknown>;
  const typingUntil = typing ? new Date(Date.now() + 7_000).toISOString() : null;
  const { error } = await admin
    .from("visitor_sessions")
    .update({ metadata: { ...metadata, typing_until: typingUntil } })
    .eq("id", visitor.visitorSessionId);
  if (error) throw error;
  return { active: Boolean(typingUntil), typingUntil };
}
