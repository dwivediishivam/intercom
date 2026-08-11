import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { createAgentMessage, getConversationWorkspace, listConversationMessages } from "@/lib/conversations";
import { sendEmailReply } from "@/lib/email";
import { toErrorResponse } from "@/lib/http";
import { agentMessageSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    void _request;
    const { conversationId } = await context.params;
    uuidSchema.parse(conversationId);
    const conversation = await getConversationWorkspace(conversationId);
    await requireWorkspaceMembership(conversation.workspace_id);
    const messages = await listConversationMessages(conversationId);
    return NextResponse.json({ messages });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await context.params;
    uuidSchema.parse(conversationId);
    const input = agentMessageSchema.parse(await request.json());
    const conversation = await getConversationWorkspace(conversationId);
    const { user } = await requireWorkspaceMembership(conversation.workspace_id);
    const result = await createAgentMessage({
      conversationId,
      actorProfileId: user.id,
      ...input,
    });

    if (result.conversation.channel === "email") {
      await sendEmailReply({
        conversationId,
        messageId: result.message.id,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
      });
    }

    return NextResponse.json({ message: result.message }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
