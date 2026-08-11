import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { createCustomDomain } from "@/lib/domains";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { customDomainSchema, uuidSchema } from "@/lib/validation";

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
      .from("custom_domains")
      .select("id, hostname, status, verification_checked_at, failure_reason, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ domains: data ?? [] });
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
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const { hostname } = customDomainSchema.parse(await request.json());
    const result = await createCustomDomain({ workspaceId, hostname });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
