import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { widgetBootstrapSchema } from "@/lib/validation";
import { enforceRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { bootstrapVisitor } from "@/lib/widget";

export const dynamic = "force-dynamic";

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

    return NextResponse.json({
      workspaceName: visitor.workspaceName,
      visitorToken: visitor.visitorToken,
      conversation: visitor.conversation,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
