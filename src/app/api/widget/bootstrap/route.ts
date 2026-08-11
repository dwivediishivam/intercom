import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { widgetBootstrapSchema } from "@/lib/validation";
import { enforceRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { bootstrapVisitor } from "@/lib/widget";
import { widgetOptions, withWidgetCors } from "@/lib/widget-response";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return widgetOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    const input = widgetBootstrapSchema.parse(await request.json());
    await enforceRateLimit({
      key: `widget-bootstrap:${input.workspacePublicId}:${getRequestFingerprint(request)}`,
      maxHits: 60,
      windowSeconds: 60,
    });
    const visitor = await bootstrapVisitor({
      ...input,
      requestOrigin: request.headers.get("origin"),
    });

    return withWidgetCors(request, NextResponse.json({
      workspaceName: visitor.workspaceName,
      visitorToken: visitor.visitorToken,
      conversation: visitor.conversation,
      messages: visitor.messages,
    }));
  } catch (error) {
    return withWidgetCors(request, toErrorResponse(error));
  }
}
