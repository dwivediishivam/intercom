"use client";

import { useState } from "react";

import { WidgetDemoSurface } from "@/components/knowledge-and-widget";

export default function DemoPage() {
  const [message, setMessage] = useState<string | null>(null);
  return <><WidgetDemoSurface onToast={setMessage} />{message && <div className="toast" role="status"><span className="toast__dot" />{message}<button onClick={() => setMessage(null)}>×</button></div>}</>;
}
