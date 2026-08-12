import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import type { DemoConversation } from "@/lib/demo-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email";

export const dynamic = "force-dynamic";

type WorkspaceRow = { id: string; public_id: string; name: string; slug: string };
type MemberRow = {
  profile_id: string;
  role: "admin" | "agent";
  profiles: { full_name: string | null; timezone: string | null } | null;
};

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
    if (!user) return { kind: "unauthenticated" as const };

    const { data: profile } = await supabase.from("profiles").select("full_name, timezone").eq("id", user.id).maybeSingle();
    try {
      await sendWelcomeEmailIfNeeded({
        userId: user.id,
        email: user.email,
        fullName: profile?.full_name || user.user_metadata.full_name || user.user_metadata.name,
      });
    } catch (welcomeError) {
      // Welcome delivery should never block authentication or workspace setup.
      console.error("Unable to send welcome email", welcomeError);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, public_id, name, slug)")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return { kind: "onboarding" as const };

    const workspace = membership.workspaces as unknown as WorkspaceRow | null;
    if (!workspace) return { kind: "onboarding" as const };
    const [{ data: conversations, error: conversationsError }, { data: members, error: membersError }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, contact_id, channel, status, subject, assignee_id, priority, last_message_at, last_message_preview, first_customer_message_at, first_agent_reply_at, resolved_at")
        .eq("workspace_id", workspace.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100),
      supabase
        .from("workspace_members")
        .select("profile_id, role, profiles(full_name, timezone)")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
    ]);
    if (conversationsError) throw conversationsError;
    if (membersError) throw membersError;

    const ownName = profile?.full_name || user.user_metadata.full_name || user.email?.split("@")[0] || "Workspace owner";
    const workspaceMembers = ((members ?? []) as unknown as MemberRow[]).map((member, index) => {
      const memberName = member.profiles?.full_name || (member.profile_id === user.id ? ownName : "Team member");
      return {
        id: member.profile_id,
        name: memberName,
        initials: initials(memberName),
        role: member.role === "admin" ? "Admin" : "Agent",
        location: member.profiles?.timezone || "Workspace member",
        tone: (["current", "sage", "sand", "peach"] as const)[index % 4],
      };
    });
    const memberById = new Map(workspaceMembers.map((member) => [member.id, member]));

    const contactIds = [...new Set((conversations ?? []).map((conversation) => conversation.contact_id))];
    const { data: contacts, error: contactsError } = contactIds.length
      ? await supabase.from("contacts").select("id, name, email").in("id", contactIds)
      : { data: [], error: null };
    if (contactsError) throw contactsError;
    const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]));
    const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
    const { data: recentMessages, error: recentMessagesError } = conversationIds.length
      ? await supabase
          .from("messages")
          .select("conversation_id, sender_type, sent_at")
          .in("conversation_id", conversationIds)
          .order("sent_at", { ascending: false })
          .limit(500)
      : { data: [], error: null };
    if (recentMessagesError) throw recentMessagesError;
    const latestSenderByConversation = new Map<string, string>();
    for (const message of recentMessages ?? []) {
      if (!latestSenderByConversation.has(message.conversation_id)) {
        latestSenderByConversation.set(message.conversation_id, message.sender_type);
      }
    }

    const initialConversations: DemoConversation[] = (conversations ?? []).map((conversation, index) => {
      const contact = contactById.get(conversation.contact_id);
      const contactName = contact?.name || "Website visitor";
      const priority = conversation.priority >= 2 ? "urgent" : undefined;
      const waitingForFirstReplyMinutes = conversation.first_customer_message_at && !conversation.first_agent_reply_at
        ? (Date.now() - new Date(conversation.first_customer_message_at).getTime()) / 60_000
        : 0;
      const sla = conversation.status === "resolved"
        ? { label: "Resolved", state: "met" as const }
        : waitingForFirstReplyMinutes > 240
          ? { label: "First reply overdue", state: "breached" as const }
          : priority
            ? { label: "Priority attention", state: "at-risk" as const }
          : { label: "On track", state: "met" as const };
      return {
        id: conversation.id,
        contactId: conversation.contact_id,
        name: contactName,
        email: contact?.email || "No email captured",
        location: "Customer profile",
        initials: initials(contactName),
        avatarTone: (["peach", "sand", "sage", "lavender"] as const)[index % 4],
        channel: conversation.channel,
        status: conversation.status,
        subject: conversation.subject || (conversation.channel === "email" ? "Email conversation" : "Website chat"),
        preview: conversation.last_message_preview || "No message preview available yet.",
        assigneeId: conversation.assignee_id,
        assignee: conversation.assignee_id
          ? (() => {
              const member = memberById.get(conversation.assignee_id);
              return member ? { name: member.name, initials: member.initials, tone: member.role === "Admin" ? "terracotta" as const : "moss" as const } : null;
            })()
          : null,
        tag: conversation.channel === "email" ? "Email" : "Live chat",
        updatedLabel: updatedLabel(conversation.last_message_at),
        unread: false,
        awaitingCustomer: ["agent", "ai"].includes(latestSenderByConversation.get(conversation.id) ?? ""),
        priority,
        sla,
      };
    });

    return {
      kind: "workspace" as const,
      workspace: {
        id: workspace.id,
        publicId: workspace.public_id,
        name: workspace.name,
        slug: workspace.slug,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
        inboundEmailDomain: process.env.RESEND_INBOUND_DOMAIN ?? null,
        currentUser: { id: user.id, name: ownName, initials: initials(ownName), role: membership.role === "admin" ? "Admin" : "Agent", location: profile?.timezone || "Your workspace" },
        members: workspaceMembers,
      },
      conversations: initialConversations,
    };
  } catch (error) {
    console.error("Unable to load workspace", error);
    return { kind: "unavailable" as const };
  }
}

export default async function AppPage() {
  const view = await getWorkspaceView();
  if (view.kind === "unauthenticated") redirect("/login");
  if (view.kind === "onboarding") redirect("/onboarding");
  if (view.kind === "workspace") return <AppShell initialWorkspace={view.workspace} initialConversations={view.conversations} isDemo={false} />;
  redirect("/login?error=workspace_unavailable");
}
