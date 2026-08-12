"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { HelpCenterSurface } from "@/components/knowledge-and-widget";

export default function HelpPage() {
  return <Suspense fallback={<main className="help-center" />}><HelpPageContent /></Suspense>;
}

function HelpPageContent() {
  const [message, setMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const workspacePublicId = searchParams.get("workspace")?.trim() || undefined;
  const initialArticleSlug = searchParams.get("article")?.trim() || undefined;
  return <><HelpCenterSurface onToast={setMessage} live={Boolean(workspacePublicId)} workspacePublicId={workspacePublicId} initialArticleSlug={initialArticleSlug} />{message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}</>;
}
