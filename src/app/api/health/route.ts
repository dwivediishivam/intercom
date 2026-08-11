import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    service: "customer-communication-platform",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
