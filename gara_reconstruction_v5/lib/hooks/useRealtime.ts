'use client';

import { useEffect, useCallback, useRef } from 'react';
import { REALTIME_CHANNELS, ChannelName } from '@/lib/realtime';

interface UseRealtimeOptions {
  channels?: ChannelName[];
  onMessage?: (data: RealtimeMessage) => void;
  onConnect?: () => void;
  onError?: (error: Event) => void;
}

interface RealtimeMessage {
  type?: string;
  channel?: string;
  operation?: string;
  table?: string;
  old?: any;
  new?: any;
  timestamp?: string;
  [key: string]: any;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    channels = [REALTIME_CHANNELS.activity],
    onMessage,
    onConnect,
    onError,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const channelsParam = channels.join(',');
    const es = new EventSource(`/api/realtime?channels=${channelsParam}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      reconnectAttempts.current = 0;
      onConnect?.();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeMessage;
        onMessage?.(data);
      } catch (err) {
        console.error('[useRealtime] Failed to parse message:', err);
      }
    };

    es.onerror = (event) => {
      onError?.(event);
      es.close();

      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current += 1;
          connect();
        }, delay);
      } else {
        console.error('[useRealtime] Max reconnection attempts reached');
      }
    };
  }, [channels, onMessage, onConnect, onError]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return {
    disconnect: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    },
  };
}

export function useScRealtime(onScChange: (data: RealtimeMessage) => void) {
  return useRealtime({
    channels: [REALTIME_CHANNELS.sc, REALTIME_CHANNELS.kho],
    onMessage: onScChange,
  });
}

export function useKhoRealtime(onKhoChange: (data: RealtimeMessage) => void) {
  return useRealtime({
    channels: [REALTIME_CHANNELS.vattu, REALTIME_CHANNELS.kho, REALTIME_CHANNELS.nhap_xuat],
    onMessage: onKhoChange,
  });
}

export function useActivityRealtime(onActivity: (data: RealtimeMessage) => void) {
  return useRealtime({
    channels: [REALTIME_CHANNELS.activity],
    onMessage: onActivity,
  });
}