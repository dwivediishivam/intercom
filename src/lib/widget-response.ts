import { NextRequest, NextResponse } from "next/server";

/**
 * The POST handlers still verify a workspace's configured origins. These CORS
 * headers only let a browser make the request from an embedded installation.
 */
export function withWidgetCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "content-type");
  response.headers.set("Vary", "Origin");
  return response;
}

export function widgetOptions(request: NextRequest) {
  return withWidgetCors(request, new NextResponse(null, { status: 204 }));
}
