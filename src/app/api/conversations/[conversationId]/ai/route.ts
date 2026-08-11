import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateConversationSummary, generateReplyDraft } from "@/lib/ai";
import { requireWorkspaceMembership } from "@/lib/auth";
import { getConversationWorkspace } from "@/lib/conversations";
import { toErrorResponse } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

const schema = z.object({ action: z.enum(["summary", "reply_draft"]) });

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await context.params;
    uuidSchema.parse(conversationId);
    const { action } = schema.parse(await request.json());
    const conversation = await getConversationWorkspace(conversationId);
    await requireWorkspaceMembership(conversation.workspace_id);

    const result =
      action === "summary"
        ? await generateConversationSummary(conversationId)
        : await generateReplyDraft(conversationId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
