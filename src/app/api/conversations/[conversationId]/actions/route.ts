import { NextRequest, NextResponse } from "next/server";

import { applyConversationAction, getConversationWorkspace } from "@/lib/conversations";
import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { conversationActionSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await context.params;
    uuidSchema.parse(conversationId);
    const action = conversationActionSchema.parse(await request.json());
    const conversation = await getConversationWorkspace(conversationId);
    const roles = action.action === "assign" ? ["admin"] as const : undefined;
    const { user } = await requireWorkspaceMembership(conversation.workspace_id, roles ? [...roles] : undefined);
    const result = await applyConversationAction(conversationId, action, user.id);
    return NextResponse.json({ conversation: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
