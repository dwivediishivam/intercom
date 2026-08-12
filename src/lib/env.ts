import { z } from "zod";

/** Hosting dashboards commonly submit optional values as an empty string. */
function blankToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalServerString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalServerEmail = z.preprocess(blankToUndefined, z.string().email().optional());
const modelName = z.preprocess(blankToUndefined, z.string().min(1).default("gpt-5-mini"));

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: optionalServerString,
  OPENAI_MODEL: modelName,
  RESEND_API_KEY: optionalServerString,
  RESEND_WEBHOOK_SECRET: optionalServerString,
  RESEND_FROM_EMAIL: optionalServerEmail,
  RESEND_INBOUND_DOMAIN: optionalServerString,
  WEBHOOK_ENCRYPTION_KEY: optionalServerString,
  CRON_SECRET: optionalServerString,
  VERCEL_TOKEN: optionalServerString,
  VERCEL_TEAM_ID: optionalServerString,
  VERCEL_PROJECT_ID: optionalServerString,
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getPublicEnvironment() {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

export function getServerEnvironment(): ServerEnvironment {
  return serverEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_INBOUND_DOMAIN: process.env.RESEND_INBOUND_DOMAIN,
    WEBHOOK_ENCRYPTION_KEY: process.env.WEBHOOK_ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  });
}
