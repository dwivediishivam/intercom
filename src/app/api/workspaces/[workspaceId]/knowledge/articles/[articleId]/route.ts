import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { updateKnowledgeArticle } from "@/lib/knowledge-admin";
import { knowledgeArticleSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; articleId: string }> },
) {
  try {
    const { workspaceId, articleId } = await context.params;
    uuidSchema.parse(workspaceId);
    uuidSchema.parse(articleId);
    const { user } = await requireWorkspaceMembership(workspaceId, ["admin"]);
    const article = await updateKnowledgeArticle({
      workspaceId,
      articleId,
      updatedBy: user.id,
      ...knowledgeArticleSchema.parse(await request.json()),
    });
    return NextResponse.json({ article });
  } catch (error) {
    return toErrorResponse(error);
  }
}
