import { getServerEnvironment } from "@/lib/env";

/** Adds a verified hostname to the current Vercel project for managed TLS. */
export async function attachVercelDomain(hostname: string) {
  const environment = getServerEnvironment();
  if (!environment.VERCEL_TOKEN || !environment.VERCEL_PROJECT_ID) {
    return { configured: false as const, reason: "Vercel domain automation is not configured." };
  }

  const query = environment.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(environment.VERCEL_TEAM_ID)}` : "";
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(environment.VERCEL_PROJECT_ID)}/domains${query}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${environment.VERCEL_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ name: hostname }),
    },
  );
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; name?: string };
  if (!response.ok && response.status !== 409) {
    throw new Error(payload.error?.message ?? "Vercel could not attach this custom domain.");
  }
  return { configured: true as const, hostname: payload.name ?? hostname };
}
