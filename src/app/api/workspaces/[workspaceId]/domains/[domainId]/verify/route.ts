import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { verifyCustomDomain } from "@/lib/domains";
import { toErrorResponse } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string; domainId: string }> },
) {
  try {
    const { workspaceId, domainId } = await context.params;
    uuidSchema.parse(workspaceId);
    uuidSchema.parse(domainId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    return NextResponse.json(await verifyCustomDomain(domainId, workspaceId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
