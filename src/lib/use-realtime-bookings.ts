"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Table = "bookings" | "barber_blocks" | "waitlist" | "clients";

/**
 * Hook Supabase Realtime — push live de toute modification de table.
 * Appelle onChange à chaque INSERT/UPDATE/DELETE.
 * Fallback polling toutes les 5 min si WebSocket déconnecte.
 */
export function useRealtimeTable(
  channelName: string,
  tables: Table[],
  onChange: () => void,
  pollMs = 300000
) {
  useEffect(() => {
    let channel = supabase.channel(channelName);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange()
      );
    }
    channel.subscribe();

    const interval = setInterval(onChange, pollMs);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [channelName, JSON.stringify(tables), pollMs]); // eslint-disable-line react-hooks/exhaustive-deps
}
