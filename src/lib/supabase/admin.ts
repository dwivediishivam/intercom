import { createClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env";

/**
 * Server-only client that bypasses row-level security. Never import this module
 * from client components, edge middleware, or widget JavaScript.
 */
export function createAdminClient() {
  const environment = getServerEnvironment();

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
