import { sanitizeRichText } from "@/lib/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createKnowledgeCategory({
  workspaceId,
  name,
  slug,
  description,
  position,
}: {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  position?: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_categories")
    .insert({
      workspace_id: workspaceId,
      name,
      slug,
      description: description ?? null,
      position: position ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createKnowledgeSection({
  workspaceId,
  categoryId,
  name,
  slug,
  description,
  position,
}: {
  workspaceId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  position?: number;
}) {
  const admin = createAdminClient();
  const { data: category, error: categoryError } = await admin
    .from("knowledge_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (categoryError) throw categoryError;
  if (!category) throw new Error("Knowledge-base category was not found.");

  const { data, error } = await admin
    .from("knowledge_sections")
    .insert({
      workspace_id: workspaceId,
      category_id: categoryId,
      name,
      slug,
      description: description ?? null,
      position: position ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createKnowledgeArticle({
  workspaceId,
  sectionId,
  title,
  slug,
  excerpt,
  contentJson,
  contentHtml,
  status,
  authorId,
}: {
  workspaceId: string;
  sectionId: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  status: "draft" | "published" | "archived";
  authorId: string;
}) {
  const admin = createAdminClient();
  const { data: section, error: sectionError } = await admin
    .from("knowledge_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (sectionError) throw sectionError;
  if (!section) throw new Error("Knowledge-base section was not found.");

  const publishedAt = status === "published" ? new Date().toISOString() : null;
  const { data, error } = await admin
    .from("knowledge_articles")
    .insert({
      workspace_id: workspaceId,
      section_id: sectionId,
      title,
      slug,
      excerpt: excerpt ?? null,
      content_json: contentJson,
      content_html: sanitizeRichText(contentHtml),
      status,
      published_at: publishedAt,
      author_id: authorId,
      updated_by: authorId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateKnowledgeArticle({
  workspaceId,
  articleId,
  sectionId,
  title,
  slug,
  excerpt,
  contentJson,
  contentHtml,
  status,
  updatedBy,
}: {
  workspaceId: string;
  articleId: string;
  sectionId: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  status: "draft" | "published" | "archived";
  updatedBy: string;
}) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("knowledge_articles")
    .select("id, published_at")
    .eq("id", articleId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("Knowledge-base article was not found.");

  const { data, error } = await admin
    .from("knowledge_articles")
    .update({
      section_id: sectionId,
      title,
      slug,
      excerpt: excerpt ?? null,
      content_json: contentJson,
      content_html: sanitizeRichText(contentHtml),
      status,
      published_at: status === "published" ? current.published_at ?? new Date().toISOString() : null,
      updated_by: updatedBy,
    })
    .eq("id", articleId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
