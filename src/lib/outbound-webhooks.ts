import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { getServerEnvironment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const DELIVERY_TIMEOUT_MS = 8_000;

export function signWebhookPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string) {
  const expected = Buffer.from(signWebhookPayload(payload, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function getEncryptionKey() {
  const rawKey = getServerEnvironment().WEBHOOK_ENCRYPTION_KEY;
  if (!rawKey) throw new Error("WEBHOOK_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new Error("WEBHOOK_ENCRYPTION_KEY must decode to 32 bytes.");
  return key;
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptSecret(encodedValue: string) {
  const [ivValue, authTagValue, ciphertextValue] = encodedValue.split(".");
  if (!ivValue || !authTagValue || !ciphertextValue) throw new Error("Invalid webhook secret ciphertext.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function createWebhookSubscription({
  workspaceId,
  url,
  eventTypes,
  createdBy,
}: {
  workspaceId: string;
  url: string;
  eventTypes: string[];
  createdBy: string;
}) {
  new URL(url);
  const secret = `whsec_${randomBytes(32).toString("base64url")}`;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webhook_subscriptions")
    .insert({
      workspace_id: workspaceId,
      url,
      event_types: [...new Set(eventTypes)],
      secret_hash: createHash("sha256").update(secret).digest("hex"),
      secret_ciphertext: encryptSecret(secret),
      created_by: createdBy,
    })
    .select("id, url, event_types, active, created_at")
    .single();
  if (error) throw error;

  // Return the plaintext only at creation; callers must never store it again.
  return { subscription: data, secret };
}

/**
 * Enqueues each configured external webhook. A Vercel Cron route will deliver and
 * retry the records, avoiding request-time fanout and preserving audit history.
 */
export async function enqueueWorkspaceWebhook({
  workspaceId,
  eventType,
  payload,
}: {
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("webhook_subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .contains("event_types", [eventType]);
  if (error) throw error;
  if (!subscriptions?.length) return 0;

  const { error: insertError } = await admin.from("webhook_deliveries").insert(
    subscriptions.map((subscription) => ({
      workspace_id: workspaceId,
      subscription_id: subscription.id,
      event_type: eventType,
      payload,
      status: "pending",
      next_attempt_at: new Date().toISOString(),
    })),
  );
  if (insertError) throw insertError;
  return subscriptions.length;
}

export async function deliverWebhook(deliveryId: string) {
  const admin = createAdminClient();
  const { data: delivery, error } = await admin
    .from("webhook_deliveries")
    .select("id, subscription_id, attempts, event_type, payload")
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) throw error;
  if (!delivery) return { skipped: true };

  const { data: subscription, error: subscriptionError } = await admin
    .from("webhook_subscriptions")
    .select("url, secret_ciphertext, active")
    .eq("id", delivery.subscription_id)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription?.active) return { skipped: true };

  const payload = JSON.stringify({
    id: delivery.id,
    type: delivery.event_type,
    created_at: new Date().toISOString(),
    data: delivery.payload,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(subscription.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-event": delivery.event_type,
        "x-platform-delivery": delivery.id,
        "x-platform-signature": signWebhookPayload(payload, decryptSecret(subscription.secret_ciphertext)),
      },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`);
    await admin
      .from("webhook_deliveries")
      .update({
        status: "delivered",
        attempts: delivery.attempts + 1,
        response_code: response.status,
        delivered_at: new Date().toISOString(),
        next_attempt_at: null,
        last_error: null,
      })
      .eq("id", delivery.id);
    return { delivered: true };
  } catch (error) {
    clearTimeout(timeout);
    const attempts = delivery.attempts + 1;
    const terminal = attempts >= outboundWebhookSettings.maxAttempts;
    const retryDelayMs = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(attempts - 1, 7));
    await admin
      .from("webhook_deliveries")
      .update({
        status: terminal ? "failed" : "retrying",
        attempts,
        last_error: error instanceof Error ? error.message : "Unknown delivery failure",
        next_attempt_at: terminal ? null : new Date(Date.now() + retryDelayMs).toISOString(),
      })
      .eq("id", delivery.id);
    return { delivered: false, terminal };
  }
}

export const outboundWebhookSettings = {
  deliveryTimeoutMs: DELIVERY_TIMEOUT_MS,
  maxAttempts: 8,
};
