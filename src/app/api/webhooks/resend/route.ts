import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import { getServerEnvironment } from "@/lib/env";
import { ingestInboundEmail, type InboundEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function extractEmailAddress(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/<([^>]+)>/);
  return (match?.[1] ?? text).trim().toLowerCase();
}

function extractDisplayName(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(.+?)\s*<[^>]+>$/);
  return match?.[1]?.trim().replace(/^"|"$/g, "") || undefined;
}

function asEmailArray(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return values.map(extractEmailAddress).filter(Boolean);
}

function asReferences(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "").match(/<[^>]+>|[^\s]+/g) ?? [];
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: NextRequest) {
  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY || !environment.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Email webhooks are not configured." }, { status: 503 });
  }

  try {
    const payload = await request.text();
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 400 });
    }

    const resend = new Resend(environment.RESEND_API_KEY);
    const event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: environment.RESEND_WEBHOOK_SECRET,
    }) as unknown as { type?: string; data?: { email_id?: string } };

    if (event.type !== "email.received" || !event.data?.email_id) {
      return NextResponse.json({ received: true });
    }

    const { data: receivedEmail, error } = await resend.emails.receiving.get(event.data.email_id);
    if (error || !receivedEmail) throw error ?? new Error("Unable to retrieve inbound email.");

    const email = receivedEmail as unknown as Record<string, unknown>;
    const headers = (email.headers ?? {}) as Record<string, unknown>;
    const fromHeader = email.from ?? headers.from;
    const inbound: InboundEmail = {
      providerEventId: id,
      receivedAt: String(email.created_at ?? email.received_at ?? new Date().toISOString()),
      from: {
        email: extractEmailAddress(fromHeader),
        name: extractDisplayName(fromHeader),
      },
      to: asEmailArray(email.to ?? headers.to),
      subject: asOptionalString(email.subject ?? headers.subject),
      text: String(email.text ?? ""),
      html: typeof email.html === "string" ? email.html : undefined,
      messageId: asOptionalString(email.message_id ?? headers["message-id"]),
      inReplyTo: asOptionalString(email.in_reply_to ?? headers["in-reply-to"]),
      references: asReferences(email.references ?? headers.references),
    };

    if (!inbound.from.email || inbound.to.length === 0) {
      throw new Error("Inbound email did not contain usable sender and recipient addresses.");
    }

    const result = await ingestInboundEmail(inbound);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Invalid or failed Resend webhook", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }
}
