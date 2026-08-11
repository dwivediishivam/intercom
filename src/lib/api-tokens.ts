import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createApiToken({
  workspaceId,
  name,
  scopes,
  createdBy,
  expiresAt,
}: {
  workspaceId: string;
  name: string;
  scopes: string[];
  createdBy: string;
  expiresAt?: string;
}) {
  const rawToken = `ccp_live_${randomBytes(32).toString("base64url")}`;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_tokens")
    .insert({
      workspace_id: workspaceId,
      name,
      token_prefix: rawToken.slice(0, 13),
      token_hash: hashApiToken(rawToken),
      scopes: [...new Set(scopes)],
      expires_at: expiresAt ?? null,
      created_by: createdBy,
    })
    .select("id, name, token_prefix, scopes, expires_at, created_at")
    .single();
  if (error) throw error;
  return { token: rawToken, apiToken: data };
}

export async function authenticateApiToken(rawToken: string, requiredScope: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, workspace_id, scopes, expires_at, revoked_at")
    .eq("token_hash", hashApiToken(rawToken))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at) <= new Date())) {
    throw new Error("Invalid API token.");
  }
  if (!data.scopes.includes(requiredScope) && !data.scopes.includes("*")) {
    throw new Error("This API token does not have the required scope.");
  }

  await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}
