"use client";

import { useState } from "react";

import { HelpCenterSurface } from "@/components/knowledge-and-widget";

export default function HelpPage() {
  const [message, setMessage] = useState<string | null>(null);
  return <><HelpCenterSurface onToast={setMessage} />{message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}</>;
}
