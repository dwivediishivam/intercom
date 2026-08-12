import { AuthenticationSurface } from "@/components/auth-screens";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return <AuthenticationSurface initialMode={mode === "signup" ? "sign-up" : "sign-in"} nextPath={nextPath} />;
}
