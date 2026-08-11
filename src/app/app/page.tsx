import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import type { DemoConversation } from "@/lib/demo-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type WorkspaceRow = { id: string; name: string; slug: string };

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ME";
}

function updatedLabel(value: string | null) {
  if (!value) return "Now";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

async function getWorkspaceView() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { kind: "demo" as const };

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, name, slug)")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return { kind: "onboarding" as const };

    const workspace = membership.workspaces as unknown as WorkspaceRow | null;
    if (!workspace) return { kind: "onboarding" as const };
    const [{ data: profile }, { data: conversations, error: conversationsError }] = await Promise.all([
      supabase.from("profiles").select("full_name, timezone").eq("id", user.id).maybeSingle(),
      supabase.from("conversations").select("id, contact_id, channel, status, subject, assignee_id, priority, last_message_at, last_message_preview").eq("workspace_id", workspace.id).order("last_message_at", { ascending: false, nullsFirst: false }).limit(100),
    ]);
    if (conversationsError) throw conversationsError;

    const contactIds = [...new Set((conversations ?? []).map((conversation) => conversation.contact_id))];
    const { data: contacts, error: contactsError } = contactIds.length
      ? await supabase.from("contacts").select("id, name, email").in("id", contactIds)
      : { data: [], error: null };
    if (contactsError) throw contactsError;
    const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]));

    const ownName = profile?.full_name || user.user_metadata.full_name || user.email?.split("@")[0] || "Workspace owner";
    const initialConversations: DemoConversation[] = (conversations ?? []).map((conversation, index) => {
      const contact = contactById.get(conversation.contact_id);
      const contactName = contact?.name || "Website visitor";
      const priority = conversation.priority >= 2 ? "urgent" : undefined;
      const staleForMinutes = conversation.last_message_at ? (Date.now() - new Date(conversation.last_message_at).getTime()) / 60_000 : 0;
      const sla = conversation.status === "resolved"
        ? { label: "Resolved", state: "met" as const }
        : priority || staleForMinutes > 240
          ? { label: "Needs attention", state: "breached" as const }
          : { label: "On track", state: "met" as const };
      return {
        id: conversation.id,
        name: contactName,
        email: contact?.email || "No email captured",
        location: "Customer profile",
        initials: initials(contactName),
        avatarTone: (["peach", "sand", "sage", "lavender"] as const)[index % 4],
        channel: conversation.channel,
        status: conversation.status,
        subject: conversation.subject || (conversation.channel === "email" ? "Email conversation" : "Website chat"),
        preview: conversation.last_message_preview || "No message preview available yet.",
        assignee: conversation.assignee_id === user.id ? { name: ownName.split(" ")[0], initials: initials(ownName), tone: "terracotta" } : null,
        tag: conversation.channel === "email" ? "Email" : "Live chat",
        updatedLabel: updatedLabel(conversation.last_message_at),
        unread: false,
        priority,
        sla,
      };
    });

    return {
      kind: "workspace" as const,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        currentUser: { name: ownName, initials: initials(ownName), role: membership.role === "admin" ? "Admin" : "Agent", location: profile?.timezone || "Your workspace" },
      },
      conversations: initialConversations,
    };
  } catch {
    // A public preview remains usable before local credentials are configured.
    return { kind: "demo" as const };
  }
}

export default async function AppPage() {
  const view = await getWorkspaceView();
  if (view.kind === "onboarding") redirect("/onboarding");
  if (view.kind === "workspace") return <AppShell initialWorkspace={view.workspace} initialConversations={view.conversations} isDemo={false} />;
  return <AppShell />;
}
