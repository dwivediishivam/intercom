import { NextRequest, NextResponse } from "next/server";

import { authenticateApiToken } from "@/lib/api-tokens";
import { toErrorResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { conversationFiltersSchema, paginationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function extractBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("A bearer API token is required.");
  return authorization.slice("Bearer ".length).trim();
}

export async function GET(request: NextRequest) {
  try {
    const token = await authenticateApiToken(extractBearerToken(request), "conversations:read");
    const filters = conversationFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { limit } = paginationSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const admin = createAdminClient();
    let query = admin
      .from("conversations")
      .select("id, channel, status, subject, assignee_id, last_message_at, last_message_preview, created_at, contacts(id, name, email)")
      .eq("workspace_id", token.workspace_id)
      .order("last_message_at", { ascending: false })
      .limit(limit);
    if (filters.channel) query = query.eq("channel", filters.channel);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.assigneeId !== undefined) query = query.eq("assignee_id", filters.assigneeId);
    if (filters.query) query = query.ilike("last_message_preview", `%${filters.query.replace(/[,%_]/g, "")}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}
