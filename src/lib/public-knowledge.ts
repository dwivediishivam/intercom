import { createAdminClient } from "@/lib/supabase/admin";

export async function resolvePublicKnowledgeWorkspace(hostname: string) {
  const admin = createAdminClient();
  const normalizedHost = hostname.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const { data: domain, error: domainError } = await admin
    .from("custom_domains")
    .select("workspace_id")
    .eq("hostname", normalizedHost)
    .eq("status", "active")
    .maybeSingle();
  if (domainError) throw domainError;
  if (domain) return domain.workspace_id;

  return null;
}

export async function getPublicKnowledgeHome(workspaceId: string) {
  const admin = createAdminClient();
  const [{ data: categories, error: categoriesError }, { data: sections, error: sectionsError }, { data: articles, error: articlesError }] =
    await Promise.all([
      admin
        .from("knowledge_categories")
        .select("id, name, slug, description, position")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true }),
      admin
        .from("knowledge_sections")
        .select("id, category_id, name, slug, description, position")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true }),
      admin
        .from("knowledge_articles")
        .select("id, section_id, title, slug, excerpt, published_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "published")
        .order("published_at", { ascending: false }),
    ]);
  if (categoriesError) throw categoriesError;
  if (sectionsError) throw sectionsError;
  if (articlesError) throw articlesError;

  return (categories ?? []).map((category) => ({
    ...category,
    sections: (sections ?? [])
      .filter((section) => section.category_id === category.id)
      .map((section) => ({
        ...section,
        articles: (articles ?? []).filter((article) => article.section_id === section.id),
      })),
  }));
}
