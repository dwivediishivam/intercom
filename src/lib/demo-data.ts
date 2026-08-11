export type ConversationChannel = "chat" | "email";
export type ConversationStatus = "open" | "snoozed" | "resolved";
export type SlaState = "met" | "at-risk" | "breached";

export type DemoConversation = {
  id: string;
  name: string;
  email: string;
  location: string;
  initials: string;
  avatarTone: "peach" | "sand" | "sage" | "lavender";
  channel: ConversationChannel;
  status: ConversationStatus;
  subject: string;
  preview: string;
  assignee: { name: string; initials: string; tone: "ink" | "moss" | "terracotta" } | null;
  tag: string;
  updatedLabel: string;
  unread: boolean;
  priority?: "urgent";
  sla: { label: string; state: SlaState };
};

/**
 * A single presentation workspace for unauthenticated product previews. The
 * authenticated product reads the same shape from Supabase and does not seed
 * this data into any customer workspace.
 */
export const demoWorkspace = {
  name: "Intercom",
  slug: "intercom-demo",
  currentUser: { name: "Aditi Sharma", initials: "AS", role: "Admin", location: "Mumbai" },
  conversations: [
    {
      id: "conv-priya",
      name: "Priya Raghavan",
      email: "priya.raghavan@papertrail.in",
      location: "Bengaluru, IN",
      initials: "PR",
      avatarTone: "peach",
      channel: "chat",
      status: "open",
      subject: "Checkout fails on the annual plan",
      preview: "It keeps spinning after I pay. I tried two cards and a different browser.",
      assignee: { name: "Aditi", initials: "AS", tone: "terracotta" },
      tag: "Billing",
      updatedLabel: "2m",
      unread: true,
      priority: "urgent",
      sla: { label: "First reply due 6m", state: "at-risk" },
    },
    {
      id: "conv-arjun",
      name: "Arjun Kapoor",
      email: "arjun@studiofield.co",
      location: "New Delhi, IN",
      initials: "AK",
      avatarTone: "sand",
      channel: "email",
      status: "open",
      subject: "Re: Invoice INV-1048 — GSTIN missing",
      preview: "Thanks for the quick turnaround. Could you also reissue the January invoice?",
      assignee: { name: "Kavya", initials: "KI", tone: "moss" },
      tag: "Invoicing",
      updatedLabel: "18m",
      unread: true,
      sla: { label: "Resolution due 3h", state: "met" },
    },
    {
      id: "conv-sana",
      name: "Sana Khan",
      email: "sana@orbitlane.in",
      location: "Mumbai, IN",
      initials: "SK",
      avatarTone: "lavender",
      channel: "chat",
      status: "open",
      subject: "SSO login loops after our domain change",
      preview: "Everyone on our team gets redirected back to the sign-in page.",
      assignee: null,
      tag: "Authentication",
      updatedLabel: "41m",
      unread: true,
      priority: "urgent",
      sla: { label: "Breached 12m", state: "breached" },
    },
    {
      id: "conv-nikhil",
      name: "Nikhil Bansal",
      email: "nikhil@northstarworks.in",
      location: "Gurugram, IN",
      initials: "NB",
      avatarTone: "sage",
      channel: "email",
      status: "open",
      subject: "Exporting our conversation history to CSV",
      preview: "Is there a limit on the date range for an account export?",
      assignee: { name: "Rohan", initials: "RM", tone: "ink" },
      tag: "How-to",
      updatedLabel: "2h",
      unread: false,
      sla: { label: "Resolution due 1d", state: "met" },
    },
    {
      id: "conv-meera",
      name: "Meera Iyer",
      email: "meera@acornlabs.in",
      location: "Chennai, IN",
      initials: "MI",
      avatarTone: "peach",
      channel: "chat",
      status: "snoozed",
      subject: "Need an additional week to test our migration",
      preview: "We are waiting on a final export from our old help desk.",
      assignee: { name: "Aditi", initials: "AS", tone: "terracotta" },
      tag: "Migration",
      updatedLabel: "Yesterday",
      unread: false,
      sla: { label: "Snoozed until 09:00", state: "at-risk" },
    },
    {
      id: "conv-rahul",
      name: "Rahul Verma",
      email: "rahul@mapleandco.in",
      location: "Pune, IN",
      initials: "RV",
      avatarTone: "sand",
      channel: "email",
      status: "resolved",
      subject: "How do I add another support teammate?",
      preview: "Perfect, the invitation arrived. Thank you for the help.",
      assignee: { name: "Kavya", initials: "KI", tone: "moss" },
      tag: "Team",
      updatedLabel: "Mon",
      unread: false,
      sla: { label: "Resolved in 31m", state: "met" },
    },
  ] satisfies DemoConversation[],
};
