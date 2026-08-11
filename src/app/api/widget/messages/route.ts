import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { widgetMessageSchema } from "@/lib/validation";
import { enforceRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { sendVisitorMessage } from "@/lib/widget";
import { bootstrapVisitor } from "@/lib/widget";
import { widgetOptions, withWidgetCors } from "@/lib/widget-response";
import { uuidSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const historySchema = z.object({
  workspacePublicId: uuidSchema,
  visitorToken: z.string().min(32).max(256),
});

export function OPTIONS(request: NextRequest) {
  return widgetOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const input = historySchema.parse({
      workspacePublicId: request.nextUrl.searchParams.get("workspacePublicId"),
      visitorToken: request.nextUrl.searchParams.get("visitorToken"),
    });
    await enforceRateLimit({
      key: `widget-history:${input.workspacePublicId}:${getRequestFingerprint(request)}`,
      maxHits: 60,
      windowSeconds: 60,
    });
    const visitor = await bootstrapVisitor({ ...input, requestOrigin: request.headers.get("origin") });
    return withWidgetCors(request, NextResponse.json({ conversation: visitor.conversation, messages: visitor.messages }));
  } catch (error) {
    return withWidgetCors(request, toErrorResponse(error));
  }
}

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
    return withWidgetCors(request, NextResponse.json(result, { status: 201 }));
  } catch (error) {
    return withWidgetCors(request, toErrorResponse(error));
  }
}
