import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { cannedResponseSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("canned_responses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ cannedResponses: data ?? [] });
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
    const input = cannedResponseSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("canned_responses")
      .insert({ workspace_id: workspaceId, created_by: user.id, ...input })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ cannedResponse: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
