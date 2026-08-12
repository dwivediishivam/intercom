import { Suspense } from "react";

import { InvitationAcceptance } from "@/components/invitation-acceptance";

export default function InvitePage() {
  return <Suspense fallback={<main className="invitation-page"><section><p>Loading invitation…</p></section></main>}><InvitationAcceptance /></Suspense>;
}
