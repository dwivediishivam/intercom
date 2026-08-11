import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { createWorkspaceSchema } from "@/lib/validation";
import { createWorkspaceForCurrentUser } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
    const input = createWorkspaceSchema.parse(await request.json());
    const workspaceId = await createWorkspaceForCurrentUser(input);
    return NextResponse.json({ workspaceId }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
