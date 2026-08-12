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

type AiReplyResult = {
  reply: string;
  usedFallback: boolean;
  escalated: boolean;
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

function fallbackSummary(messages: Array<{ sender_type: string; body_text: string }>) {
  const customerMessages = messages.filter((message) => message.sender_type === "contact");
  const teamMessages = messages.filter((message) => message.sender_type === "agent" || message.sender_type === "ai");
  const latestCustomer = customerMessages.at(-1)?.body_text.trim() || "No customer message has been recorded yet.";
  const latestTeam = teamMessages.at(-1)?.body_text.trim();
  return [
    `Customer need: ${latestCustomer.slice(0, 260)}`,
    `Tried: ${customerMessages.length > 1 ? "The customer has provided additional context in this thread." : "No prior troubleshooting steps are recorded."}`,
    `Current status: ${latestTeam ? `The team last replied: ${latestTeam.slice(0, 180)}` : "Awaiting a team response."}`,
  ].join("\n");
}

function fallbackReply(message: string, article?: { title: string; excerpt: string | null; content_html: string }) {
  if (article) {
    const excerpt = (article.excerpt ?? article.content_html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    return `I can help with that. ${article.title}: ${excerpt.slice(0, 330)}${excerpt.length > 330 ? "…" : ""}`;
  }
  if (/hello|hi\b|hey/i.test(message)) return "Hi! I’m the support assistant. Tell me what you need help with and I’ll either find the right answer or bring in a teammate.";
  return "Thanks for reaching out. I’ve shared this with the team and a teammate will follow up shortly.";
}

function isSimpleGreeting(message: string) {
  return /^(?:hi|hello|hey|hii+|good\s+(?:morning|afternoon|evening))(?:\s+(?:there|team|support))?[!.\s]*$/i.test(message.trim());
}

function greetingInstructions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const instructions = (value as Record<string, unknown>).ai_greeting_instructions;
  return typeof instructions === "string" ? instructions.trim().slice(0, 1500) : "";
}

function shouldEscalate(message: string) {
  return /\b(human|agent|person|refund|cancel|chargeback|billing|payment|invoice|security|privacy|legal|urgent|critical|broken|bug|error|not working|complaint)\b/i.test(message);
}

async function requestText({
  instructions,
  input,
  maxOutputTokens,
}: {
  instructions: string;
  input: string;
  maxOutputTokens: number;
}) {
  const client = getOpenAIClient();
  const environment = getServerEnvironment();
  if (!client) return null;
  const response = await client.responses.create({
    model: environment.OPENAI_MODEL,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: "low" },
    store: false,
  });
  return {
    text: response.output_text.trim(),
    model: environment.OPENAI_MODEL,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
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

  let generated: Awaited<ReturnType<typeof requestText>> = null;
  try {
    generated = await requestText({
      instructions: "Summarize support conversations accurately. Do not invent facts or give advice. Return exactly three concise labeled lines: Customer need:, Tried:, Current status:. Keep the complete response under 150 tokens.",
      input: `Previous summary (may be empty):\n${previousSummary?.summary ?? ""}\n\nRecent conversation:\n${transcriptFromMessages(chronologicalMessages)}`,
      maxOutputTokens: 180,
    });
  } catch (error) {
    console.warn("AI summary request failed; using factual fallback.", error);
  }
  const summary = generated?.text || fallbackSummary(chronologicalMessages);

  const { error: upsertError } = await admin.from("ai_summaries").upsert(
    {
      conversation_id: conversationId,
      workspace_id: conversation.workspace_id,
      summary,
      source_last_message_id: latestMessageId,
      model: generated?.model ?? `${environment.OPENAI_MODEL}:fallback`,
      input_tokens: generated?.inputTokens ?? 0,
      output_tokens: generated?.outputTokens ?? 0,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" },
  );
  if (upsertError) throw upsertError;

  await recordAiUsage({
    workspaceId: conversation.workspace_id,
    conversationId,
    feature: "conversation_summary",
    model: generated?.model ?? `${environment.OPENAI_MODEL}:fallback`,
    inputTokens: generated?.inputTokens ?? 0,
    outputTokens: generated?.outputTokens ?? 0,
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

  let generated: Awaited<ReturnType<typeof requestText>> = null;
  try {
    generated = await requestText({
      instructions: "Draft a short, empathetic support reply. Only state facts supported by the conversation or knowledge snippets. Do not claim an issue is fixed. Do not add a subject line, greeting, signature, or markdown. Keep it under 120 tokens.",
      input: `Conversation:\n${transcriptFromMessages([...(messages ?? [])].reverse())}\n\nKnowledge snippets:\n${knowledge || "No relevant knowledge-base content supplied."}`,
      maxOutputTokens: 150,
    });
  } catch (error) {
    console.warn("AI draft request failed; using a safe fallback.", error);
  }
  const draft = generated?.text || fallbackReply(messages?.at(0)?.body_text ?? "", articles?.[0]);

  await recordAiUsage({
    workspaceId: conversation.workspace_id,
    conversationId,
    feature: "reply_draft",
    model: generated?.model ?? `${environment.OPENAI_MODEL}:fallback`,
    inputTokens: generated?.inputTokens ?? 0,
    outputTokens: generated?.outputTokens ?? 0,
  });

  return { draft };
}

/**
 * Customer-facing chat gets one concise assistant reply immediately. It is
 * deliberately bounded, based only on published workspace articles, and falls
 * back to a truthful acknowledgement whenever the provider is unavailable.
 */
export async function generateWidgetAutoReply({
  workspaceId,
  conversationId,
  message,
}: {
  workspaceId: string;
  conversationId: string;
  message: string;
}): Promise<AiReplyResult> {
  const admin = createAdminClient();
  const escalated = shouldEscalate(message);
  const [{ data: articles, error }, { data: workspace, error: workspaceError }] = await Promise.all([
    admin
      .from("knowledge_articles")
      .select("title, excerpt, content_html")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .limit(8),
    admin.from("workspaces").select("name, brand_settings").eq("id", workspaceId).maybeSingle(),
  ]);
  if (error) throw error;
  if (workspaceError) throw workspaceError;
  const terms = message.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  const article = (articles ?? []).sort((left, right) => {
    const score = (entry: typeof left) => terms.reduce((total, term) => total + (`${entry.title} ${entry.excerpt ?? ""} ${entry.content_html}`.toLowerCase().includes(term) ? 1 : 0), 0);
    return score(right) - score(left);
  })[0];
  const client = getOpenAIClient();
  if (!client) return { reply: fallbackReply(message, article), usedFallback: true, escalated };

  try {
    await assertAiQuota(workspaceId);
    const knowledge = article ? `Relevant article:\n${article.title}\n${(article.excerpt ?? article.content_html.replace(/<[^>]+>/g, " ")).slice(0, 900)}` : "No matching published help article.";
    const greetingGuidance = greetingInstructions(workspace?.brand_settings);
    const greetingMode = isSimpleGreeting(message);
    const generated = await requestText({
      instructions: greetingMode
        ? "You are a customer-support assistant. This is a simple greeting. Reply warmly in 55 tokens or fewer, introduce the product accurately from the workspace greeting instructions, then ask how you can help. Do not invent capabilities, add a signature, markdown, or labels."
        : "You are a customer-support assistant. Answer the visitor directly in 90 tokens or fewer, using only the supplied help article and their message. Never invent policy or claim a fix. If the issue needs a human, say that a teammate will follow up and ask for the minimum needed detail. No greeting, signature, markdown, or labels.",
      input: `Workspace: ${workspace?.name ?? "Support team"}\n${greetingMode ? `Workspace greeting instructions:\n${greetingGuidance || "Warmly welcome the visitor, briefly explain the product only if known, then ask what they need help with."}\n\n` : ""}Visitor message:\n${message.slice(0, MAX_MESSAGE_CHARS)}\n\n${knowledge}`,
      maxOutputTokens: 130,
    });
    const providerReply = generated?.text;
    // A provider occasionally returns a generic escalation even when a matched
    // article contains the answer. Prefer the grounded local rendering in that
    // case so the visitor receives useful help immediately.
    const providerDeclinedKnownAnswer = Boolean(article && providerReply && /doesn.?t (include|cover|have)|teammate will follow up|cannot find/i.test(providerReply));
    const reply = !providerDeclinedKnownAnswer && providerReply ? providerReply : fallbackReply(message, article);
    await recordAiUsage({ workspaceId, conversationId, feature: "reply_draft", model: generated?.model ?? `${getServerEnvironment().OPENAI_MODEL}:fallback`, inputTokens: generated?.inputTokens ?? 0, outputTokens: generated?.outputTokens ?? 0 });
    return { reply, usedFallback: !providerReply || providerDeclinedKnownAnswer, escalated };
  } catch (error) {
    console.warn("Widget AI reply failed; using a safe fallback.", error);
    return { reply: fallbackReply(message, article), usedFallback: true, escalated };
  }
}
