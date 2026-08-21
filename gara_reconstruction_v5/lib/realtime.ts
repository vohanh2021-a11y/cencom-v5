import pg from 'pg';
import { createScopedLogger } from './observability';

const log = createScopedLogger('realtime');

export const REALTIME_CHANNELS = {
  activity: 'activity_log_changes',
  vattu: 'vattu_changes',
  sc: 'sc_changes',
  kho: 'sc_vattu_changes',
  nhap_xuat: 'nhap_xuat_changes',
} as const;

export type ChannelName = typeof REALTIME_CHANNELS[keyof typeof REALTIME_CHANNELS];

interface Subscriber {
  callback: (payload: any) => void;
  channels: Set<ChannelName>;
}

const subscribers = new Map<string, Subscriber>();
let pgClient: pg.Client | null = null;
let isListening = false;

export function createRealtimeChannel(channel: ChannelName) {
  return {
    notify: (payload: any) => notifyChannel(channel, payload),
    subscribe: (callback: (payload: any) => void) => subscribeToChannel(channel, callback),
    unsubscribe: () => unsubscribeFromChannel(channel),
  };
}

export function getPgNotificationClient(): pg.Client {
  if (!pgClient) {
    pgClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    pgClient.connect();
  }
  return pgClient;
}

export async function listenPgNotifications(client: pg.Client, channels: ChannelName[]) {
  if (isListening) return;
  isListening = true;

  for (const channel of channels) {
    await client.query(`LISTEN ${channel}`);
  }

  client.on('notification', (msg) => {
    const channel = msg.channel as ChannelName | undefined;
    if (!channel) return;
    if (!msg.payload) return;
    const payload = JSON.parse(msg.payload);
    dispatchToSubscribers(channel, payload);
  });

  client.on('error', (err) => {
    log.logError('PG client error', err);
    isListening = false;
  });

  client.on('end', () => {
    log.logInfo('PG client disconnected');
    isListening = false;
  });
}

export async function notifyChannel(channel: ChannelName, payload: any) {
  const client = getPgNotificationClient();
  await client.query('NOTIFY $1, $2', [channel, JSON.stringify(payload)]) as any;
}

function subscribeToChannel(channel: ChannelName, callback: (payload: any) => void): () => void {
  const id = `${channel}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  subscribers.set(id, { callback, channels: new Set([channel]) });
  return () => unsubscribeFromChannel(id);
}

function unsubscribeFromChannel(idOrChannel: string) {
  if (subscribers.has(idOrChannel)) {
    subscribers.delete(idOrChannel);
  } else {
    for (const [id, sub] of subscribers.entries()) {
      if (sub.channels.has(idOrChannel as ChannelName)) {
        subscribers.delete(id);
      }
    }
  }
}

function dispatchToSubscribers(channel: ChannelName, payload: any) {
  for (const [, sub] of subscribers.entries()) {
    if (sub.channels.has(channel)) {
      try {
        sub.callback({ channel, ...payload });
      } catch (err) {
        log.logError('Subscriber callback error', err, { channel });
      }
    }
  }
}

export function subscribeToChannels(channels: ChannelName[], onMessage: (data: any) => void): () => void {
  const client = getPgNotificationClient();
  listenPgNotifications(client, channels);

  const unsubscribers = channels.map((ch) => subscribeToChannel(ch, onMessage));
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}