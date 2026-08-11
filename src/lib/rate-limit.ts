import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please try again shortly.");
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit({
  key,
  maxHits,
  windowSeconds,
}: {
  key: string;
  maxHits: number;
  windowSeconds: number;
}) {
  const bucketKey = createHash("sha256").update(key).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    target_bucket_key: bucketKey,
    max_hits: maxHits,
    window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (!data) throw new RateLimitError();
}

export function getRequestFingerprint(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${request.headers.get("user-agent") ?? "unknown"}`;
}
