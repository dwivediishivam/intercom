import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { widgetMessageSchema } from "@/lib/validation";
import { enforceRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { sendVisitorMessage } from "@/lib/widget";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = widgetMessageSchema.parse(await request.json());
    await enforceRateLimit({
      key: `widget-message:${input.workspacePublicId}:${getRequestFingerprint(request)}`,
      maxHits: 20,
      windowSeconds: 60,
    });
    const result = await sendVisitorMessage({
      ...input,
      requestOrigin: request.headers.get("origin"),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
