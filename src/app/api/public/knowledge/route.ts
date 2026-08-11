import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/http";
import { searchPublicKnowledgeBase } from "@/lib/knowledge";
import { getPublicKnowledgeHome, resolvePublicKnowledgeWorkspace } from "@/lib/public-knowledge";

const querySchema = z.object({ query: z.string().trim().max(300).optional() });

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const hostname = request.headers.get("host");
    if (!hostname) return NextResponse.json({ error: "Host is required." }, { status: 400 });
    const workspaceId = await resolvePublicKnowledgeWorkspace(hostname);
    if (!workspaceId) return NextResponse.json({ error: "Knowledge base not found." }, { status: 404 });
    const { query } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    if (query) {
      return NextResponse.json({ articles: await searchPublicKnowledgeBase({ workspaceId, query }) });
    }
    return NextResponse.json({ categories: await getPublicKnowledgeHome(workspaceId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
