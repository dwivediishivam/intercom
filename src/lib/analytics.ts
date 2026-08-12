import { createAdminClient } from "@/lib/supabase/admin";

type AnalyticsRange = { from: Date; to: Date };

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
}

export async function getWorkspaceAnalytics(workspaceId: string, range: AnalyticsRange) {
  const admin = createAdminClient();
  const { data: conversations, error } = await admin
    .from("conversations")
    .select("id, channel, status, assignee_id, created_at, first_customer_message_at, first_agent_reply_at, resolved_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString());
  if (error) throw error;

  const firstResponseSeconds: number[] = [];
  const resolutionSeconds: number[] = [];
  const busiestHours = Array.from({ length: 24 }, (_, hour) => ({ hour, conversations: 0 }));
  const agentPerformance = new Map<string, { assigned: number; resolved: number; responseSeconds: number[] }>();

  for (const conversation of conversations ?? []) {
    busiestHours[new Date(conversation.created_at).getUTCHours()].conversations += 1;
    const customerAt = conversation.first_customer_message_at
      ? new Date(conversation.first_customer_message_at).getTime()
      : null;
    const firstReplyAt = conversation.first_agent_reply_at
      ? new Date(conversation.first_agent_reply_at).getTime()
      : null;
    const resolvedAt = conversation.resolved_at ? new Date(conversation.resolved_at).getTime() : null;
    const responseTime = customerAt && firstReplyAt ? Math.max(0, Math.round((firstReplyAt - customerAt) / 1000)) : null;
    const resolutionTime = customerAt && resolvedAt ? Math.max(0, Math.round((resolvedAt - customerAt) / 1000)) : null;
    if (responseTime !== null) firstResponseSeconds.push(responseTime);
    if (resolutionTime !== null) resolutionSeconds.push(resolutionTime);

    if (conversation.assignee_id) {
      const performance = agentPerformance.get(conversation.assignee_id) ?? {
        assigned: 0,
        resolved: 0,
        responseSeconds: [],
      };
      performance.assigned += 1;
      if (conversation.status === "resolved") performance.resolved += 1;
      if (responseTime !== null) performance.responseSeconds.push(responseTime);
      agentPerformance.set(conversation.assignee_id, performance);
    }
  }

  return {
    volume: conversations?.length ?? 0,
    resolved: conversations?.filter((conversation) => conversation.status === "resolved").length ?? 0,
    channels: {
      chat: conversations?.filter((conversation) => conversation.channel === "chat").length ?? 0,
      email: conversations?.filter((conversation) => conversation.channel === "email").length ?? 0,
    },
    averageFirstResponseSeconds: average(firstResponseSeconds),
    averageResolutionSeconds: average(resolutionSeconds),
    busiestHours,
    agentPerformance: [...agentPerformance.entries()].map(([agentId, performance]) => ({
      agentId,
      assigned: performance.assigned,
      resolved: performance.resolved,
      averageFirstResponseSeconds: average(performance.responseSeconds),
    })),
  };
}
