import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    void _request;
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId);
    const admin = createAdminClient();
    const [{ data: categories, error: categoriesError }, { data: sections, error: sectionsError }, { data: articles, error: articlesError }] = await Promise.all([
      admin.from("knowledge_categories").select("id, name, slug, description, position").eq("workspace_id", workspaceId).order("position"),
      admin.from("knowledge_sections").select("id, category_id, name, slug, description, position").eq("workspace_id", workspaceId).order("position"),
      admin.from("knowledge_articles").select("id, section_id, title, slug, excerpt, content_html, status, updated_at, published_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    ]);
    if (categoriesError) throw categoriesError;
    if (sectionsError) throw sectionsError;
    if (articlesError) throw articlesError;
    return NextResponse.json({ categories: categories ?? [], sections: sections ?? [], articles: articles ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}
