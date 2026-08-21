import { NextRequest, NextResponse } from 'next/server';
import { subscribeToChannels, REALTIME_CHANNELS, ChannelName } from '@/lib/realtime';
import { getCurrentActor, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth gate: SSE stream đẩy dữ liệu nghiệp vụ (activity_log, sc, vattu...)
  // → bắt buộc đăng nhập. EventSource tự gửi cookie same-origin nên UI không bị ảnh hưởng.
  const actor = getCurrentActor(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const channelsParam = req.nextUrl.searchParams.get('channels');
  const channels: ChannelName[] = channelsParam
    ? (channelsParam.split(',') as ChannelName[])
    : [REALTIME_CHANNELS.activity];

  const invalidChannels = channels.filter((c) => !Object.values(REALTIME_CHANNELS).includes(c));
  if (invalidChannels.length > 0) {
    return NextResponse.json({ error: `Invalid channels: ${invalidChannels.join(', ')}` }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'connected', channels, timestamp: new Date().toISOString() });

      const unsubscribe = subscribeToChannels(channels, send);

      req.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}