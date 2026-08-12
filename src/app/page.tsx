import { headers } from "next/headers";

import { MarketingLanding } from "@/components/marketing-landing";
import { PublicHelpPage } from "@/components/public-help-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const host = (await headers()).get("host")?.toLowerCase().replace(/:\d+$/, "") ?? "";
  const applicationHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : "";
  const isApplicationHost = !host || host === applicationHost || host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
  if (!isApplicationHost) return <PublicHelpPage />;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <MarketingLanding isAuthenticated={Boolean(user)} />;
}
