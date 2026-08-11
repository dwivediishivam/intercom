import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceMembership } from "@/lib/auth";
import { getContactTimeline } from "@/lib/contacts";
import { toErrorResponse } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ workspaceId: string; contactId: string }> },
) {
  try {
    const { workspaceId, contactId } = await context.params;
    uuidSchema.parse(workspaceId);
    uuidSchema.parse(contactId);
    await requireWorkspaceMembership(workspaceId);
    return NextResponse.json(await getContactTimeline({ workspaceId, contactId }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
