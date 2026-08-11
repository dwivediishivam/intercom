import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/env";
import { deliverWebhook } from "@/lib/outbound-webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const environment = getServerEnvironment();
  if (!environment.CRON_SECRET) {
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${environment.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: deliveries, error } = await admin
    .from("webhook_deliveries")
    .select("id")
    .in("status", ["pending", "retrying"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw error;

  const results = [];
  for (const delivery of deliveries ?? []) {
    results.push(await deliverWebhook(delivery.id));
  }
  return NextResponse.json({ processed: results.length, results });
}
