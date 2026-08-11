import { bootstrapVisitor } from "@/lib/widget";
import { createAdminClient } from "@/lib/supabase/admin";

export async function suggestKnowledgeArticles({
  workspacePublicId,
  visitorToken,
  query,
  requestOrigin,
}: {
  workspacePublicId: string;
  visitorToken: string;
  query: string;
  requestOrigin: string | null;
}) {
  const visitor = await bootstrapVisitor({
    workspacePublicId,
    visitorToken,
    requestOrigin,
  });
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_articles")
    .select("id, title, slug, excerpt")
    .eq("workspace_id", visitor.workspaceId)
    .eq("status", "published")
    .textSearch("search_document", normalizedQuery, {
      type: "websearch",
      config: "english",
    })
    .limit(3);
  if (error) throw error;
  return data ?? [];
}

export async function searchPublicKnowledgeBase({
  workspaceId,
  query,
  limit = 20,
}: {
  workspaceId: string;
  query: string;
  limit?: number;
}) {
  const admin = createAdminClient();
  const queryBuilder = admin
    .from("knowledge_articles")
    .select("id, title, slug, excerpt, published_at, knowledge_sections(name, slug, knowledge_categories(name, slug))")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  const { data, error } = query.trim()
    ? await queryBuilder.textSearch("search_document", query, {
        type: "websearch",
        config: "english",
      })
    : await queryBuilder;
  if (error) throw error;
  return data ?? [];
}
