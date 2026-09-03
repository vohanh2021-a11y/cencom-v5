import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelRouter, ModelEntry } from "../src/modelRouter.js";

const pool: ModelEntry[] = [
  { id: "opencode/hy3-free", provider: "zen" },
  { id: "2009/mimo-v2.5", provider: "b.ai" },
  { id: "2009/hy3", provider: "b.ai" },
];

test("starts at first model", () => {
  const r = new ModelRouter({ pool, cooldownMs: 1000, maxAttempts: 3 });
  assert.equal(r.current.id, "opencode/hy3-free");
});

test("fail advances to next healthy model", () => {
  const r = new ModelRouter({ pool, cooldownMs: 1000, maxAttempts: 3 });
  const next = r.fail();
  assert.equal(next.id, "2009/mimo-v2.5");
  assert.equal(r.current.id, "2009/mimo-v2.5");
});

test("failed model is skipped and wraps around", () => {
  const r = new ModelRouter({ pool, cooldownMs: 60_000, maxAttempts: 3 });
  r.fail(); // hy3-free down -> mimo-v2.5
  r.fail(); // mimo-v2.5 down -> 2009/hy3
  r.fail(); // all cooling -> keeps last
  assert.equal(r.current.id, "2009/hy3");
});

test("on failure prefers a DIFFERENT provider (cross-provider switch zen<->b.ai)", () => {
  const p: ModelEntry[] = [
    { id: "opencode/hy3-free", provider: "zen" },
    { id: "opencode/nemotron-3-ultra-free", provider: "zen" },
    { id: "2009/mimo-v2.5", provider: "b.ai" },
    { id: "2009/hy3", provider: "b.ai" },
  ];
  const r = new ModelRouter({ pool: p, cooldownMs: 60_000, maxAttempts: 4 });
  const next = r.fail(); // current was zen -> should switch to b.ai
  assert.equal(next.provider, "b.ai");
  const next2 = r.fail(); // current now b.ai -> should switch back to zen
  assert.equal(next2.provider, "zen");
});

test("succeed marks the just-used (current) model healthy, failed one stays cooling", () => {
  const r = new ModelRouter({ pool, cooldownMs: 60_000, maxAttempts: 3 });
  r.fail(); // hy3-free -> cooling; current moved to mimo-v2.5
  r.succeed(); // marks mimo-v2.5 healthy
  const used = r.status().find((x) => x.id === "2009/mimo-v2.5");
  assert.equal(used!.healthy, true);
  const failed = r.status().find((x) => x.id === "opencode/hy3-free");
  assert.equal(failed!.healthy, false); // still in cooldown, correct
});

test("cooldown auto-expires so a recovered model returns to the pool", () => {
  const r = new ModelRouter({ pool, cooldownMs: 20, maxAttempts: 3 });
  r.fail(); // hy3-free cooling for 20ms
  const failedNow = r.status().find((x) => x.id === "opencode/hy3-free")!;
  assert.equal(failedNow.healthy, false);
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const recovered = r.status().find((x) => x.id === "opencode/hy3-free")!;
      assert.equal(recovered.healthy, true);
      resolve();
    }, 40);
  });
});

test("status reports positive cooldown seconds while cooling", () => {
  const r = new ModelRouter({ pool, cooldownMs: 5000, maxAttempts: 3 });
  r.fail();
  const s = r.status().find((x) => x.id === "opencode/hy3-free")!;
  assert.equal(s.healthy, false);
  assert.ok(s.cooldownSec > 0 && s.cooldownSec <= 5);
});

test("empty pool throws", () => {
  assert.throws(() => new ModelRouter({ pool: [], cooldownMs: 1, maxAttempts: 1 }));
});

test("rotateProactively: no rotation before dwell elapses", () => {
  const r = new ModelRouter({ pool, cooldownMs: 60_000, maxAttempts: 3, dwellMs: 100_000 });
  assert.equal(r.rotateProactively(), null);
  assert.equal(r.current.id, "opencode/hy3-free");
});

test("rotateProactively: rotates immediately when dwellMs=0 and prefers a DIFFERENT provider", () => {
  const p: ModelEntry[] = [
    { id: "opencode/hy3-free", provider: "zen" },
    { id: "2009/mimo-v2.5", provider: "b.ai" },
    { id: "2009/hy3", provider: "b.ai" },
  ];
  const r = new ModelRouter({ pool: p, cooldownMs: 60_000, maxAttempts: 3, dwellMs: 0 });
  const before = r.current;
  const rotated = r.rotateProactively();
  assert.notEqual(rotated, null);
  assert.notEqual(r.current.id, before.id);
  assert.equal(r.current.provider, "b.ai"); // cross-provider
});

test("rotateProactively: rotates after dwell elapses (real-timer)", () => {
  const r = new ModelRouter({ pool, cooldownMs: 60_000, maxAttempts: 3, dwellMs: 10 });
  assert.equal(r.rotateProactively(), null); // chưa tới hạn
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const rotated = r.rotateProactively();
      assert.notEqual(rotated, null);
      assert.notEqual(r.current.id, "opencode/hy3-free");
      resolve();
    }, 30);
  });
});

test("promptWithFallback uses 30-min periodic rotation, not slowness", async () => {
  // Giả lập: model thứ 1 CHẬM (có chunk nhưng qua timeout) -> KHÔNG switch chỉ vì chậm.
  // Dùng timeout rất cao (noResponseTimeoutMs lớn) -> timeout đầu chunk không trigger switch.
  const cfg: any = {
    opencodeServeUrl: "http://x",
    opencodeServeToken: "",
    telegramBotToken: "1234567890abcdef",
    allowedUserIds: [1],
    allowedChatIds: [],
    requireMention: true,
    maxPromptLen: 4000,
    modelPool: pool,
    cooldownMs: 0,
    maxAttempts: 3,
    noResponseTimeoutMs: 50, // test giữ nhỏ để test "dead" path
    dwellMs: 0, // ép xoay ngay để test proactive rotation
    logLevel: "ERROR",
  };
  let eventsCalls = 0;
  const client: any = {
    session: {
      list: async () => ({ sessions: [] }),
      create: async () => ({ id: "S1" }),
      status: async () => ({}),
      abort: async () => {},
      prompt: async () => {},
      messages: async () => ({ messages: [] }),
    },
    v2: {
      session: {
        prompt: async () => {},
        events: async ({ onSseEvent }: any) => {
          eventsCalls++;
          onSseEvent({
            data: { id: "e", event: "part", data: JSON.stringify({ type: "part", part: { type: "text", text: "Hi" } }) },
          });
        },
        switchModel: async () => {},
        question: { list: async () => ({ questions: [] }) },
        permission: { reply: async () => {} },
      },
    },
    permission: { list: async () => ({ permissions: [] }), reply: async () => {} },
  };
  const { OpencodeBridge } = await import("../src/opencodeClient");
  const bridge: any = new OpencodeBridge(cfg, undefined, client);
  const switched: Array<[string, string]> = [];
  await bridge.promptWithFallback("S1", "hi", {}, (from: string, to: string) => switched.push([from, to]));
  // dwellMs=0 -> 1 lần xoay định kỳ (proactive) ngay đầu, rồi model trả kết quả thành công.
  // Không được switch thêm vì chậm (vì đã có chunk).
  assert.equal(switched.length, 1, "phải chỉ xoay đúng 1 lần (định kỳ 30p), không xoay vì chậm");
});

