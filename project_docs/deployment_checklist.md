# Deployment Checklist

## Before the first deployment

1. Create a Supabase project and apply the SQL migration in `supabase/migrations/`.
2. In Supabase Auth, enable email/password and Google. Create Google OAuth credentials, add the callback URL shown by Supabase to Google, and add local/Vercel URLs to Supabase’s allowed redirect URLs.
3. Create a Resend account, verify a domain for sending and receiving, configure a `support@...` address, and register the production `/api/webhooks/resend` endpoint for `email.received` plus delivery events.
4. Add all values from `.env.example` to Vercel Project Settings. Keep every unprefixed value server-only.
5. In OpenAI billing, set an account/project usage limit at or below the planned USD 5 development budget. The app adds its own request cap and caches summaries, but the provider limit is the final safeguard.
6. Generate a random 32-byte base64 value for `WEBHOOK_ENCRYPTION_KEY` and a separate strong `CRON_SECRET`.
7. Add the production support and help-center domains to Vercel. Vercel handles TLS after the domain’s DNS records point to it.

## After deployment

1. Verify `/api/health` returns a success response.
2. Test email/password and Google sign-in, then workspace creation and an invitation acceptance flow.
3. Send a fresh email to the configured support address, reply from the dashboard, and reply again from the email client to verify one threaded conversation.
4. Configure a widget allowed origin, load the one-script-tag widget on the demo page, and test return-visitor history, real-time delivery, typing, presence, and receipts.
5. Publish a help article; test public search, widget suggestions, and the custom-domain flow.
6. Generate an AI summary/draft and review `ai_usage_events` for bounded usage.
7. Create a webhook subscription, inspect deliveries, and confirm retry behavior.
8. Review tenant isolation by testing with two workspaces and two user roles.

## Current dependency

The designer’s screen and component output is required for the dashboard, knowledge-base pages, authentication/onboarding pages, demo site, and embedded widget UI. The backend/API foundation is intentionally being completed without making those visual decisions.

