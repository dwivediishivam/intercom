import { AuthenticationSurface } from "@/components/auth-screens";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <AuthenticationSurface initialMode={mode === "signup" ? "sign-up" : "sign-in"} />;
}
