import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { enforceRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { widgetTypingSchema } from "@/lib/validation";
import { setVisitorTyping } from "@/lib/widget";
import { widgetOptions, withWidgetCors } from "@/lib/widget-response";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return widgetOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    const input = widgetTypingSchema.parse(await request.json());
    await enforceRateLimit({
      key: `widget-typing:${input.workspacePublicId}:${getRequestFingerprint(request)}`,
      maxHits: 80,
      windowSeconds: 60,
    });
    const result = await setVisitorTyping({ ...input, requestOrigin: request.headers.get("origin") });
    return withWidgetCors(request, NextResponse.json(result));
  } catch (error) {
    return withWidgetCors(request, toErrorResponse(error));
  }
}
