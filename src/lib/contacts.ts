import { createAdminClient } from "@/lib/supabase/admin";

export async function getContactTimeline({ workspaceId, contactId }: { workspaceId: string; contactId: string }) {
  const admin = createAdminClient();
  const [{ data: contact, error: contactError }, { data: conversations, error: conversationsError }, { data: visits, error: visitsError }] =
    await Promise.all([
      admin.from("contacts").select("*").eq("id", contactId).eq("workspace_id", workspaceId).maybeSingle(),
      admin
        .from("conversations")
        .select("id, channel, status, subject, last_message_at, last_message_preview, created_at")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false }),
      admin
        .from("contact_page_visits")
        .select("url, title, referrer, visited_at")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .order("visited_at", { ascending: false })
        .limit(100),
    ]);
  if (contactError) throw contactError;
  if (conversationsError) throw conversationsError;
  if (visitsError) throw visitsError;
  if (!contact) throw new Error("Contact was not found.");
  return { contact, conversations: conversations ?? [], pageVisits: visits ?? [] };
}
