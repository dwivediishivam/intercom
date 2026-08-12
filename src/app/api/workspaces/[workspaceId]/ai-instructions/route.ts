import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

const workspaceIdSchema = z.string().uuid();
const updateSchema = z.object({ greetingInstructions: z.string().trim().max(1500) });

function readGreetingInstructions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const instruction = (value as Record<string, unknown>).ai_greeting_instructions;
  return typeof instruction === "string" ? instruction : "";
}

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId: rawWorkspaceId } = await params;
    const workspaceId = workspaceIdSchema.parse(rawWorkspaceId);
    await requireWorkspaceMembership(workspaceId);
    const admin = createAdminClient();
    const { data, error } = await admin.from("workspaces").select("brand_settings").eq("id", workspaceId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ greetingInstructions: readGreetingInstructions(data?.brand_settings) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId: rawWorkspaceId } = await params;
    const workspaceId = workspaceIdSchema.parse(rawWorkspaceId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const { greetingInstructions } = updateSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data: workspace, error: loadError } = await admin.from("workspaces").select("brand_settings").eq("id", workspaceId).maybeSingle();
    if (loadError) throw loadError;
    const settings = workspace?.brand_settings && typeof workspace.brand_settings === "object" && !Array.isArray(workspace.brand_settings)
      ? workspace.brand_settings as Record<string, unknown>
      : {};
    const { error: updateError } = await admin.from("workspaces").update({ brand_settings: { ...settings, ai_greeting_instructions: greetingInstructions } }).eq("id", workspaceId);
    if (updateError) throw updateError;
    return NextResponse.json({ greetingInstructions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
