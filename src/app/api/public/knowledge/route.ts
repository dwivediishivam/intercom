import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/http";
import { searchPublicKnowledgeBase } from "@/lib/knowledge";
import { getPublicKnowledgeHome, resolvePublicKnowledgeWorkspace, resolvePublicKnowledgeWorkspaceByPublicId } from "@/lib/public-knowledge";

const querySchema = z.object({
  query: z.string().trim().max(300).optional(),
  workspace: z.string().uuid().optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { query, workspace } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const hostname = request.headers.get("host");
    const workspaceId = workspace
      ? await resolvePublicKnowledgeWorkspaceByPublicId(workspace)
      : hostname
        ? await resolvePublicKnowledgeWorkspace(hostname)
        : null;
    if (!workspaceId) return NextResponse.json({ error: "Knowledge base not found." }, { status: 404 });
    if (query) {
      return NextResponse.json({ articles: await searchPublicKnowledgeBase({ workspaceId, query }) });
    }
    return NextResponse.json({ categories: await getPublicKnowledgeHome(workspaceId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
