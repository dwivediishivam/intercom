"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Status = "connecting" | "connected" | "reconnecting" | "error";

/** Refreshes the server-rendered workspace view when durable Supabase events arrive. */
export function RealtimeBridge({ workspaceId, onStatus }: { workspaceId?: string; onStatus: (status: Status) => void }) {
  const router = useRouter();

  useEffect(() => {
    if (!workspaceId) return;
    let refreshTimer: number | undefined;
    try {
      const supabase = createBrowserSupabaseClient();
      const scheduleRefresh = () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => router.refresh(), 250);
      };
      const channel = supabase
        .channel(`workspace-inbox:${workspaceId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, scheduleRefresh)
        .subscribe((state: string) => {
          if (state === "SUBSCRIBED") onStatus("connected");
          else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") onStatus("error");
          else if (state === "CLOSED") onStatus("reconnecting");
          else onStatus("connecting");
        });
      return () => {
        window.clearTimeout(refreshTimer);
        void supabase.removeChannel(channel);
      };
    } catch {
      onStatus("error");
      return;
    }
  }, [onStatus, router, workspaceId]);

  return null;
}
