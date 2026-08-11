import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

const originsSchema = z.object({
  origins: z.array(z.string().url().transform((value) => new URL(value).origin)).max(30),
});

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    void _request;
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId);
    const admin = createAdminClient();
    const { data, error } = await admin.from("workspaces").select("widget_site_origins").eq("id", workspaceId).single();
    if (error) throw error;
    return NextResponse.json({ origins: data.widget_site_origins ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const origins = [...new Set(originsSchema.parse(await request.json()).origins)];
    const admin = createAdminClient();
    const { data, error } = await admin.from("workspaces").update({ widget_site_origins: origins }).eq("id", workspaceId).select("widget_site_origins").single();
    if (error) throw error;
    return NextResponse.json({ origins: data.widget_site_origins ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}
