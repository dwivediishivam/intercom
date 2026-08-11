import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

const updateRoleSchema = z.object({ role: z.enum(["admin", "agent"]) });

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; profileId: string }> },
) {
  try {
    const { workspaceId, profileId } = await context.params;
    uuidSchema.parse(workspaceId);
    uuidSchema.parse(profileId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const { role } = updateRoleSchema.parse(await request.json());
    const admin = createAdminClient();

    if (role === "agent") {
      const { count, error: countError } = await admin
        .from("workspace_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("role", "admin");
      if (countError) throw countError;
      const { data: target, error: targetError } = await admin
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (target?.role === "admin" && (count ?? 0) <= 1) {
        throw new Error("A workspace must retain at least one Admin.");
      }
    }

    const { data, error } = await admin
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("profile_id", profileId)
      .select("workspace_id, profile_id, role, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ member: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
