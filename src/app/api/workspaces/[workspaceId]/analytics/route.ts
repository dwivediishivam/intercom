import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getWorkspaceAnalytics } from "@/lib/analytics";
import { requireWorkspaceMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    uuidSchema.parse(workspaceId);
    await requireWorkspaceMembership(workspaceId, ["admin"]);
    const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const to = params.to ? new Date(params.to) : new Date();
    const from = params.from ? new Date(params.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (from > to) throw new Error("The analytics start date must be before the end date.");
    return NextResponse.json(await getWorkspaceAnalytics(workspaceId, { from, to }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
