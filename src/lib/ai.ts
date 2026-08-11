import OpenAI from "openai";

import { getConversationWorkspace } from "@/lib/conversations";
import { getServerEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_AI_REQUESTS_PER_WORKSPACE_PER_DAY = 50;
const MAX_TRANSCRIPT_MESSAGES = 18;
const MAX_MESSAGE_CHARS = 900;

type SummaryResult = {
  summary: string;
  cached: boolean;
  unavailable?: boolean;
};

function getOpenAIClient() {
  const environment = getServerEnvironment();
  if (!environment.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: environment.OPENAI_API_KEY });
}

function transcriptFromMessages(
  messages: Array<{ sender_type: string; body_text: string; sent_at: string }>,
) {
  return messages
    .map(
      (message) =>
        `[${message.sent_at}] ${message.sender_type}: ${message.body_text.slice(0, MAX_MESSAGE_CHARS)}`,
    )
    .join("\n");
}

async function assertAiQuota(workspaceId: string) {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", since.toISOString());

  if (error) throw error;
  if ((count ?? 0) >= MAX_AI_REQUESTS_PER_WORKSPACE_PER_DAY) {
    throw new Error("The workspace AI request limit has been reached for today.");
  }
}

async function recordAiUsage({
  workspaceId,
  conversationId,
  feature,
  model,
  inputTokens,
  outputTokens,
}: {
  workspaceId: string;
  conversationId: string;
  feature: "conversation_summary" | "reply_draft";
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_usage_events").insert({
    workspace_id: workspaceId,
    conversation_id: conversationId,
    feature,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
  if (error) throw error;
}

export async function generateConversationSummary(
  conversationId: string,
): Promise<SummaryResult> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      summary: "AI summaries are not configured for this workspace yet.",
      cached: false,
      unavailable: true,
    };
  }

  const environment = getServerEnvironment();
  const admin = createAdminClient();
  const conversation = await getConversationWorkspace(conversationId);
  const { data: messages, error: messagesError } = await admin
    .from("messages")
    .select("id, sender_type, body_text, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(MAX_TRANSCRIPT_MESSAGES);
  if (messagesError) throw messagesError;

  const chronologicalMessages = [...(messages ?? [])].reverse();
  const latestMessageId = chronologicalMessages.at(-1)?.id ?? null;
  const { data: previousSummary, error: summaryError } = await admin
    .from("ai_summaries")
    .select("summary, source_last_message_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (summaryError) throw summaryError;

  if (
    previousSummary?.source_last_message_id &&
    previousSummary.source_last_message_id === latestMessageId
  ) {
    return { summary: previousSummary.summary, cached: true };
  }

  await assertAiQuota(conversation.workspace_id);

  const response = await client.responses.create({
    model: environment.OPENAI_MODEL,
    input: [
      {
        role: "developer",
        content:
          "Summarize support conversations accurately. Do not invent facts or give advice. Return exactly three concise labeled lines: Customer need:, Tried:, Current status:. Keep the complete response under 150 tokens.",
      },
      {
        role: "user",
        content: `Previous summary (may be empty):\n${previousSummary?.summary ?? ""}\n\nRecent conversation:\n${transcriptFromMessages(chronologicalMessages)}`,
      },
    ],
    max_output_tokens: 180,
  });

  const summary = response.output_text.trim();
  if (!summary) throw new Error("The AI service returned an empty summary.");

  const { error: upsertError } = await admin.from("ai_summaries").upsert(
    {
      conversation_id: conversationId,
      workspace_id: conversation.workspace_id,
      summary,
      source_last_message_id: latestMessageId,
      model: environment.OPENAI_MODEL,
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" },
  );
  if (upsertError) throw upsertError;

  await recordAiUsage({
    workspaceId: conversation.workspace_id,
    conversationId,
    feature: "conversation_summary",
    model: environment.OPENAI_MODEL,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  return { summary, cached: false };
}

export async function generateReplyDraft(conversationId: string) {
  const client = getOpenAIClient();
  if (!client) throw new Error("AI reply drafts are not configured.");

  const environment = getServerEnvironment();
  const admin = createAdminClient();
  const conversation = await getConversationWorkspace(conversationId);
  await assertAiQuota(conversation.workspace_id);

  const [{ data: messages, error: messagesError }, { data: articles, error: articlesError }] =
    await Promise.all([
      admin
        .from("messages")
        .select("sender_type, body_text, sent_at")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: false })
        .limit(10),
      admin
        .from("knowledge_articles")
        .select("title, excerpt, content_html")
        .eq("workspace_id", conversation.workspace_id)
        .eq("status", "published")
        .limit(3),
    ]);
  if (messagesError) throw messagesError;
  if (articlesError) throw articlesError;

  const knowledge = (articles ?? [])
    .map(
      (article) =>
        `Title: ${article.title}\nExcerpt: ${(article.excerpt ?? article.content_html).slice(0, 700)}`,
    )
    .join("\n\n");

  const response = await client.responses.create({
    model: environment.OPENAI_MODEL,
    input: [
      {
        role: "developer",
        content:
          "Draft a short, empathetic support reply. Only state facts supported by the conversation or knowledge snippets. Do not claim an issue is fixed. Do not add a subject line, greeting, signature, or markdown. Keep it under 120 tokens.",
      },
      {
        role: "user",
        content: `Conversation:\n${transcriptFromMessages([...(messages ?? [])].reverse())}\n\nKnowledge snippets:\n${knowledge || "No relevant knowledge-base content supplied."}`,
      },
    ],
    max_output_tokens: 150,
  });

  const draft = response.output_text.trim();
  if (!draft) throw new Error("The AI service returned an empty reply draft.");

  await recordAiUsage({
    workspaceId: conversation.workspace_id,
    conversationId,
    feature: "reply_draft",
    model: environment.OPENAI_MODEL,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  return { draft };
}
