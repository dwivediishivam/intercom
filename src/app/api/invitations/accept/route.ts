import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { acceptWorkspaceInvitation } from "@/lib/workspaces";

const schema = z.object({ token: z.string().min(32).max(256) });

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!user.email) throw new Error("The signed-in account has no email address.");
    const { token } = schema.parse(await request.json());
    const workspaceId = await acceptWorkspaceInvitation({
      token,
      profileId: user.id,
      email: user.email,
    });
    return NextResponse.json({ workspaceId });
  } catch (error) {
    return toErrorResponse(error);
  }
}
