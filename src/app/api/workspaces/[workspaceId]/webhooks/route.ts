import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createWebhookSubscription } from "@/lib/outbound-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema, webhookSubscriptionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("webhook_subscriptions")
      .select("id, url, event_types, active, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ subscriptions: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    const { user } = await requireWorkspaceMembership(workspaceId, ["admin"]);
    const input = webhookSubscriptionSchema.parse(await request.json());
    const result = await createWebhookSubscription({ workspaceId, createdBy: user.id, ...input });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
