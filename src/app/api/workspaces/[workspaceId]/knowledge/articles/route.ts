import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createKnowledgeArticle } from "@/lib/knowledge-admin";
import { knowledgeArticleSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    const { user } = await requireWorkspaceMembership(workspaceId, ["admin"]);
    const article = await createKnowledgeArticle({
      workspaceId,
      authorId: user.id,
      ...knowledgeArticleSchema.parse(await request.json()),
    });
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
