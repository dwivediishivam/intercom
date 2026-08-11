import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

import { createAdminClient } from "@/lib/supabase/admin";
import { attachVercelDomain } from "@/lib/vercel-domains";

const hostnamePattern = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export function normalizeHostname(value: string) {
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnamePattern.test(hostname)) {
    throw new Error("Enter a valid public subdomain or domain name.");
  }
  return hostname;
}

export function getDomainDnsInstructions(hostname: string, verificationToken: string) {
  return {
    hostname,
    records: [
      {
        type: "TXT",
        host: `_platform-verify.${hostname}`,
        value: verificationToken,
        purpose: "Proves control of the domain before it is connected.",
      },
      {
        type: "CNAME",
        host: hostname,
        value: "cname.vercel-dns.com",
        purpose: "Routes the help center to Vercel for managed TLS provisioning.",
      },
    ],
  };
}

export async function createCustomDomain({ workspaceId, hostname }: { workspaceId: string; hostname: string }) {
  const admin = createAdminClient();
  const normalizedHostname = normalizeHostname(hostname);
  const verificationToken = `verify_${randomBytes(24).toString("base64url")}`;
  const { data, error } = await admin
    .from("custom_domains")
    .insert({
      workspace_id: workspaceId,
      hostname: normalizedHostname,
      verification_token: verificationToken,
      status: "pending_dns",
    })
    .select("id, hostname, status, verification_token, created_at")
    .single();
  if (error) throw error;
  return { domain: data, dns: getDomainDnsInstructions(data.hostname, data.verification_token) };
}

export async function verifyCustomDomain(domainId: string, workspaceId: string) {
  const admin = createAdminClient();
  const { data: domain, error } = await admin
    .from("custom_domains")
    .select("id, hostname, verification_token, status")
    .eq("id", domainId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) throw error;

  let txtRecords: string[][];
  try {
    txtRecords = await resolveTxt(`_platform-verify.${domain.hostname}`);
  } catch {
    await admin
      .from("custom_domains")
      .update({ verification_checked_at: new Date().toISOString() })
      .eq("id", domain.id);
    return { verified: false, reason: "Verification TXT record was not found yet." };
  }

  const isVerified = txtRecords.some((record) => record.join("") === domain.verification_token);
  let status: "pending_dns" | "verified" | "provisioning_tls" | "active" | "failed" = isVerified ? "verified" : "pending_dns";
  let failureReason: string | null = isVerified ? null : "The verification TXT record does not match.";
  if (isVerified) {
    try {
      const provision = await attachVercelDomain(domain.hostname);
      status = provision.configured ? "active" : "verified";
    } catch (error) {
      status = "failed";
      failureReason = error instanceof Error ? error.message : "TLS provisioning could not start.";
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("custom_domains")
    .update({ status, verification_checked_at: new Date().toISOString(), failure_reason: failureReason })
    .eq("id", domain.id)
    .select("id, hostname, status, verification_checked_at, failure_reason")
    .single();
  if (updateError) throw updateError;

  return { verified: isVerified, domain: updated, tlsManagedByVercel: status === "active" };
}
