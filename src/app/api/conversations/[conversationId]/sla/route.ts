import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { getConversationWorkspace } from "@/lib/conversations";
import { toErrorResponse } from "@/lib/http";
import { getConversationSlaState } from "@/lib/sla";
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
    return NextResponse.json(await getConversationSlaState(conversationId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
