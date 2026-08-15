/**
 * lib/use-realtime.ts — React hook cho Supabase Realtime (client-side).
 *
 * Dùng để subscribe changes từ DB (SC, DeXuat, Chat...) và cập nhật UI
 * mà không cần polling. Thay thế polling 45s của v3.6.
 *
 * Usage:
 *   const { payload } = useRealtime('sc', (payload) => { ... });
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from './supabase';

export interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  table: string;
}

/**
 * Subscribe một bảng cụ thể.
 * @param table - tên bảng (vd: 'sc', 'de_xuat_sua_chua', 'chat_messages')
 * @param onEvent - callback khi có change
 * @param filter - optional filter (vd: `thread_id=eq.123`)
 */
export function useRealtime(
  table: string,
  onEvent: (event: RealtimeEvent) => void,
  filter?: string,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const client = getSupabaseClient();
    const channelName = `realtime:${table}:${filter || 'all'}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          callbackRef.current({
            eventType: payload.eventType as RealtimeEvent['eventType'],
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
            table,
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
        }
      });

    return () => {
      client.removeChannel(channel);
      setConnected(false);
    };
  }, [table, filter]);

  return { connected };
}

/**
 * Subscribe nhiều bảng cùng lúc.
 */
export function useRealtimeMulti(
  tables: string[],
  onEvent: (event: RealtimeEvent) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const client = getSupabaseClient();
    const channels = tables.map((table) => {
      return client
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            callbackRef.current({
              eventType: payload.eventType as RealtimeEvent['eventType'],
              new: payload.new as Record<string, unknown>,
              old: payload.old as Record<string, unknown>,
              table,
            });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setConnected(true);
        });
    });

    return () => {
      channels.forEach((ch) => client.removeChannel(ch));
      setConnected(false);
    };
  }, [tables.join(',')]);

  return { connected };
}
