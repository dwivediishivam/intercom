import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/http";
import { suggestKnowledgeArticles } from "@/lib/knowledge";
import { uuidSchema } from "@/lib/validation";

const schema = z.object({
  workspacePublicId: uuidSchema,
  visitorToken: z.string().min(32).max(256),
  query: z.string().trim().max(300),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const articles = await suggestKnowledgeArticles({
      ...input,
      requestOrigin: request.headers.get("origin"),
    });
    return NextResponse.json({ articles });
  } catch (error) {
    return toErrorResponse(error);
  }
}
