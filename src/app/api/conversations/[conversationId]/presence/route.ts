import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { getConversationWorkspace } from "@/lib/conversations";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await context.params;
    uuidSchema.parse(conversationId);
    const conversation = await getConversationWorkspace(conversationId);
    await requireWorkspaceMembership(conversation.workspace_id);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("conversations")
      .select("visitor_sessions(last_seen_at, metadata)")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw error;
    const session = data?.visitor_sessions as unknown as { last_seen_at: string | null; metadata: Record<string, unknown> | null } | null;
    const lastSeen = session?.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
    const typingUntil = typeof session?.metadata?.typing_until === "string" ? Date.parse(session.metadata.typing_until) : 0;
    return NextResponse.json({ online: Date.now() - lastSeen < 45_000, typing: typingUntil > Date.now() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
