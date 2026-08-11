import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { createCustomDomain } from "@/lib/domains";
import { toErrorResponse } from "@/lib/http";
import { customDomainSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

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
