import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createKnowledgeSection } from "@/lib/knowledge-admin";
import { knowledgeSectionSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const section = await createKnowledgeSection({
      workspaceId,
      ...knowledgeSectionSchema.parse(await request.json()),
    });
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
