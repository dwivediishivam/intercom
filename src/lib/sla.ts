import { createAdminClient } from "@/lib/supabase/admin";

export type SlaState = {
  firstResponse: { dueAt: string | null; breached: boolean; completedAt: string | null };
  resolution: { dueAt: string | null; breached: boolean; completedAt: string | null };
};

export async function getConversationSlaState(conversationId: string): Promise<SlaState> {
  const admin = createAdminClient();
  const { data: conversation, error } = await admin
    .from("conversations")
    .select("workspace_id, status, first_customer_message_at, first_agent_reply_at, resolved_at")
    .eq("id", conversationId)
    .single();
  if (error) throw error;

  const { data: policy, error: policyError } = await admin
    .from("sla_policies")
    .select("first_response_target_minutes, resolution_target_minutes")
    .eq("workspace_id", conversation.workspace_id)
    .maybeSingle();
  if (policyError) throw policyError;

  const customerAt = conversation.first_customer_message_at
    ? new Date(conversation.first_customer_message_at)
    : null;
  if (!customerAt || !policy) {
    return {
      firstResponse: { dueAt: null, breached: false, completedAt: conversation.first_agent_reply_at },
      resolution: { dueAt: null, breached: false, completedAt: conversation.resolved_at },
    };
  }

  const now = Date.now();
  const firstResponseDue = new Date(customerAt.getTime() + policy.first_response_target_minutes * 60_000);
  const resolutionDue = new Date(customerAt.getTime() + policy.resolution_target_minutes * 60_000);
  const firstResponseCompleted = conversation.first_agent_reply_at
    ? new Date(conversation.first_agent_reply_at).getTime()
    : null;
  const resolutionCompleted = conversation.resolved_at ? new Date(conversation.resolved_at).getTime() : null;

  return {
    firstResponse: {
      dueAt: firstResponseDue.toISOString(),
      breached: (firstResponseCompleted ?? now) > firstResponseDue.getTime(),
      completedAt: conversation.first_agent_reply_at,
    },
    resolution: {
      dueAt: resolutionDue.toISOString(),
      breached: (resolutionCompleted ?? now) > resolutionDue.getTime(),
      completedAt: conversation.resolved_at,
    },
  };
}
