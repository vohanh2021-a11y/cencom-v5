import { test } from "node:test";
import assert from "node:assert/strict";
import { OpencodeBridge } from "../src/opencodeClient.js";
import { ModelRouter } from "../src/modelRouter.js";
import { DEFAULT_MODEL_POOL } from "../src/config.js";
import type { Config } from "../src/config.js";

function baseCfg(over: Partial<Config> = {}): Config {
  return {
    opencodeServeUrl: "http://localhost:4096",
    opencodeServeToken: "",
    serveAgent: "",
    telegramBotToken: "1234567890abcdef",
    telegramWebhookUrl: "",
    telegramWebhookSecret: "",
    allowedUserIds: [123],
    allowedChatIds: [],
    requireMention: false,
    maxPromptLen: 4000,
    modelPool: DEFAULT_MODEL_POOL,
    cooldownMs: 0,
    maxAttempts: 6,
    noResponseTimeoutMs: 60000,
    logLevel: "ERROR",
    ...over,
  } as unknown as Config;
}

function fakeClient(opts: { failFirstChunk?: boolean; messages?: any[] } = {}) {
  let eventsCalls = 0;
  const v2session: any = {
    create: async () => ({ data: { data: { id: "S1" } } }),
    prompt: async () => {},
    wait: async () => {},
    status: async () => ({}),
    abort: async () => {},
    messages: async () => ({ messages: opts.messages ?? [] }),
    switchModel: async () => {},
    events: async ({ onSseEvent }: any) => {
      eventsCalls++;
      if (opts.failFirstChunk && eventsCalls === 1) return; // không emit chunk -> timeout
      onSseEvent({
        data: {
          id: "e1",
          event: "part",
          data: JSON.stringify({ type: "part", part: { type: "text", text: "Hello" } }),
        },
      });
    },
    permission: { list: async () => ({ permissions: [] }), reply: async () => {} },
    question: { list: async () => ({ questions: [] }), reply: async () => {} },
  };
  const client: any = {
    _eventsCalls: () => eventsCalls,
    session: {
      list: async () => ({ sessions: [] }),
      create: async () => ({ id: "S1" }),
    },
    v2: { session: v2session },
    permission: { list: async () => ({ permissions: [] }), reply: async () => {} },
  };
  return client;
}

function fakeClientWithPermission(id: string) {
  const v2session: any = {
    create: async () => ({ data: { data: { id: "S1" } } }),
    prompt: async () => {},
    wait: async () => {},
    status: async () => ({}),
    abort: async () => {},
    messages: async () => ({ messages: [] }),
    switchModel: async () => {},
    events: async () => {},
    permission: {
      list: async () => ({ permissions: [{ id, status: "pending", tool: "write" }] }),
      reply: async () => {},
    },
    question: { list: async () => ({ questions: [] }), reply: async () => {} },
  };
  const client: any = {
    session: { list: async () => ({ sessions: [] }), create: async () => ({ id: "S1" }) },
    v2: { session: v2session },
    permission: { list: async () => ({ permissions: [] }), reply: async () => {} },
  };
  return client;
}

test("streaming bắt được chunk và KHÔNG gửi trùng (pollTail bị bỏ qua)", async () => {
  const cfg = baseCfg();
  const bridge = new OpencodeBridge(cfg, undefined, fakeClient({ messages: [{ parts: [{ text: "DUPLICATE_MARKER" }] }] }));
  const chunks: string[] = [];
  await bridge.prompt("S1", "hi", { onChunk: (t) => chunks.push(t) });
  assert.deepEqual(chunks, ["Hello"]);
});

test("pollPermissions chỉ báo 1 lần dù list trả cùng id pending nhiều lần (dedup)", async () => {
  const cfg = baseCfg();
  const bridge = new OpencodeBridge(cfg, undefined, fakeClientWithPermission("P1"));
  const notified: string[] = [];
  const h = { onPermission: (p: { id: string; description: string }) => notified.push(p.id) };
  await (bridge as any).pollPermissions("S1", h);
  await (bridge as any).pollPermissions("S1", h);
  assert.deepEqual(notified, ["P1"]);
});

test("promptWithFallback tự switch model khi model đầu không phản hồi, rồi thành công", async () => {
  const cfg = baseCfg({ noResponseTimeoutMs: 50, cooldownMs: 0 });
  const switched: Array<[string, string]> = [];
  const chunks: string[] = [];
  const bridge = new OpencodeBridge(cfg, undefined, fakeClient({ failFirstChunk: true, messages: [] }));
  await bridge.promptWithFallback(
    "S1",
    "hi",
    { onChunk: (t) => chunks.push(t) },
    (from, to) => switched.push([from, to]),
  );
  assert.equal(switched.length, 1, "phải switch đúng 1 lần");
  assert.ok(chunks.includes("Hello"), "kết quả cuối phải có Hello");
});

test("khi TẤT CẢ model fail -> ném lỗi All models failed", async () => {
  const cfg = baseCfg({ noResponseTimeoutMs: 30, maxAttempts: 3, cooldownMs: 0 });
  // client không bao giờ emit chunk -> mọi lần đều timeout
  const neverChunk = {
    session: { list: async () => ({ sessions: [] }), create: async () => ({ id: "S1" }), status: async () => ({}), abort: async () => {}, prompt: async () => {}, messages: async () => ({ messages: [] }) },
    v2: { session: { events: async () => {}, switchModel: async () => {}, question: { list: async () => ({ questions: [] }) }, permission: { reply: async () => {} } } },
    permission: { list: async () => ({ permissions: [] }), reply: async () => {} },
  };
  const bridge = new OpencodeBridge(cfg, undefined, neverChunk);
  await assert.rejects(
    () => bridge.promptWithFallback("S1", "hi", {}, () => {}),
    /All models failed/,
  );
});
