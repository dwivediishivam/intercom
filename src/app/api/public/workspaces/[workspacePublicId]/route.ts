import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Public, non-sensitive workspace identity used by the hosted widget demo. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ workspacePublicId: string }> },
) {
  try {
    const { workspacePublicId } = await context.params;
    uuidSchema.parse(workspacePublicId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("workspaces")
      .select("name, slug")
      .eq("public_id", workspacePublicId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    return NextResponse.json({ workspace: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
