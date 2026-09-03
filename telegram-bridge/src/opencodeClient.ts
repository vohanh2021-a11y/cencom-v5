import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Config } from "./config";
import { ModelRouter } from "./modelRouter";
import { log } from "./logger";

interface SessionRef {
  id?: string;
  sessionID?: string;
}
interface PermissionItem {
  id?: string;
  status?: string;
  description?: string;
  tool?: string;
  [k: string]: unknown;
}
interface QuestionItem {
  id?: string;
  question?: string;
  [k: string]: unknown;
}

export interface PromptHandlers {
  onChunk?: (text: string) => void;
  onPermission?: (p: { id: string; description: string }) => void;
  onQuestion?: (q: { id: string; question: string }) => void;
}

/** Parse một sự kiện SSE opencode thành object bên trong (bỏ các lớp wrapper). */
function parseEvent(ev: any): any | null {
  let obj = ev;
  if (ev && typeof ev.data !== "undefined") {
    let inner = ev.data;
    if (typeof inner === "string") {
      try {
        inner = JSON.parse(inner);
      } catch {
        return null;
      }
    }
    obj = inner;
  }
  if (!obj || typeof obj !== "object") return null;
  let o = obj;
  if (typeof obj.data === "string") {
    try {
      o = JSON.parse(obj.data);
    } catch {
      o = obj;
    }
  } else if (typeof obj.data === "object" && obj.data !== null) {
    o = obj.data;
  }
  return o;
}

/** Trích text từ object sự kiện đã parse. */
function extractTextFromObj(o: any): string | null {
  const candidates = [
    o?.part?.text,
    o?.parts?.[0]?.text,
    o?.message?.parts?.[0]?.text,
    o?.delta?.text,
    o?.text,
  ];
  for (const c of candidates) if (typeof c === "string" && c.length) return c;
  return null;
}

/** Phát hiện sự kiện LỖI thực sự (429/5xx/network) để failover nhanh, không nhầm model chậm. */
function detectError(o: any): string | null {
  const t = o?.type || o?.event || "";
  if (/error/i.test(t)) return "event:" + t + (o?.message ? " " + o.message : "");
  if (o?.error) return "error:" + (o.error?.message || JSON.stringify(o.error));
  if (typeof o?.status === "number" && o.status >= 400) return "status " + o.status;
  const part = o?.part || o?.data?.part;
  if (part && (part.type === "error" || part.isError)) return "part error";
  return null;
}

/** Tách "provider/model" thành providerID + modelID cho SDK v2. */
function splitModel(id: string): { providerID: string; modelID: string } {
  const i = id.indexOf("/");
  if (i === -1) return { providerID: "", modelID: id };
  return { providerID: id.slice(0, i), modelID: id.slice(i + 1) };
}

export class OpencodeBridge {
  private client: any;
  readonly router: ModelRouter;
  private notifiedPerm = new Set<string>();
  private notifiedQ = new Set<string>();

  constructor(private cfg: Config, router?: ModelRouter, clientOverride?: any) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.opencodeServeToken) headers["Authorization"] = `Bearer ${cfg.opencodeServeToken}`;
    this.client =
      clientOverride ??
      createOpencodeClient({
        baseUrl: cfg.opencodeServeUrl,
        headers,
      } as any);
    this.router =
      router ??
      new ModelRouter({
        pool: cfg.modelPool,
        cooldownMs: cfg.cooldownMs,
        maxAttempts: cfg.maxAttempts,
        dwellMs: cfg.dwellMs,
      });
  }

  async health(): Promise<boolean> {
    try {
      await this.client.session.list();
      return true;
    } catch (e) {
      log("WARN", "opencode serve unreachable", { error: String(e) });
      return false;
    }
  }

  async createSession(): Promise<string> {
    const m = splitModel(this.router.current.id);
    const body: any = { model: { id: m.modelID, providerID: m.providerID } };
    if (this.cfg.serveAgent) body.agent = this.cfg.serveAgent;
    const res = (await this.client.v2.session.create(body)) as any;
    const id =
      res?.data?.data?.id ?? res?.data?.id ?? res?.id ?? res?.sessionID;
    if (!id) throw new Error("createSession: no id returned");
    return id;
  }

  async switchModel(sessionId: string, modelId: string): Promise<void> {
    const m = splitModel(modelId);
    await this.client.v2.session.switchModel({
      sessionID: sessionId,
      model: { id: m.modelID, providerID: m.providerID },
    } as any);
  }

  async status(sessionId: string): Promise<any> {
    return this.client.v2.session.status({ sessionID: sessionId });
  }

  async abort(sessionId: string): Promise<void> {
    await this.client.v2.session.abort({ sessionID: sessionId });
  }

  async listSessions(): Promise<Array<{ id: string; title?: string }>> {
    const res = await this.client.v2.session.list({ limit: 20 } as any);
    const list =
      (res as any)?.data?.data ?? (res as any)?.data ?? (res as any)?.sessions ?? [];
    return Array.isArray(list)
      ? list.map((s: any) => ({ id: s.id ?? s.sessionID, title: s.title }))
      : [];
  }

  /** Gửi prompt một lần (không fallback). Trả về khi agent hoàn tất (wait) hoặc hết timeout. */
  async prompt(
    sessionId: string,
    text: string,
    handlers: PromptHandlers,
    state: { captured: number } = { captured: 0 },
    onError?: (reason: string) => void,
  ): Promise<void> {
    // Dedup theo event id để tránh xử lý 2 lần nếu SDK vừa gọi callback vừa trả stream.
    const seen = new Set<string>();
    const handle = (ev: any) => {
      const id = ev?.id ?? ev?.data?.id ?? JSON.stringify(ev).slice(0, 60);
      if (seen.has(id)) return;
      seen.add(id);
      this.handleEvent(ev, handlers, state, onError);
    };

    // Subscribe sự kiện (SSE). Hỗ trợ cả callback (mock) và stream (thật).
    let stop = false;
    const eventsPromise = (this.client.v2.session.events as any)(
      { sessionID: sessionId, onSseEvent: handle },
      { onSseEvent: handle },
    );
    if (eventsPromise && typeof (eventsPromise as any).then === "function") {
      (eventsPromise as any)
        .then((res: any) => {
          if (res && res.stream && typeof res.stream[Symbol.asyncIterator] === "function") {
            (async () => {
              try {
                for await (const ev of res.stream) {
                  if (stop) break;
                  handle(ev);
                }
              } catch (e) {
                log("DEBUG", "sse stream ended", { error: String(e) });
              }
            })();
          }
        })
        .catch((e: unknown) => log("DEBUG", "sse subscribe failed", { error: String(e) }));
    }

      const poll = setInterval(async () => {
      try {
        await this.pollPermissions(sessionId, handlers, this.cfg.autoApprovePermissions !== false);
      } catch {
        /* ignore */
      }
      try {
        await this.pollQuestions(sessionId, handlers);
      } catch {
        /* ignore */
      }
    }, 1500);

    try {
      await this.client.v2.session.prompt({
        sessionID: sessionId,
        prompt: { text },
      } as any);
      // Đợi agent hoàn tất (API v2 có wait). Nếu SDK không có, fallback timeout ngắn.
      try {
        if (typeof (this.client.v2.session as any).wait === "function") {
          await (this.client.v2.session as any).wait({ sessionID: sessionId });
        } else {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch {
        /* ignore */
      }
    } finally {
      clearInterval(poll);
      stop = true;
      await new Promise((r) => setTimeout(r, 600));
      try {
        await this.pollTail(sessionId, handlers, state);
      } catch {
        /* ignore */
      }
    }
  }

  /** Gửi prompt với TỰ ĐỘNG ĐỔI MODEL (xoay 30 phút HOẶC gặp 429/5xx). Không đổi vì chậm. */
  async promptWithFallback(
    sessionId: string,
    text: string,
    handlers: PromptHandlers,
    onSwitch?: (from: string, to: string, reason: string) => void,
  ): Promise<void> {
    const oldId = this.router.current.id;
    const rotated = this.router.rotateProactively();
    if (rotated && rotated.id !== oldId) {
      onSwitch?.(oldId, rotated.id, "dwell-30min");
    }

    for (let attempt = 0; attempt < this.router.cfg.maxAttempts; attempt++) {
      const model = this.router.current;
      await this.switchModel(sessionId, model.id).catch((e) =>
        log("WARN", "switchModel failed", { error: String(e) }),
      );

      let resolveFirst: () => void = () => {};
      const firstChunk = new Promise<void>((r) => {
        resolveFirst = r;
      });
      const state = { captured: 0 };
      const handlers2: PromptHandlers = {
        ...handlers,
        onChunk: (t: string) => {
          resolveFirst();
          handlers.onChunk?.(t);
        },
      };
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("NO_RESPONSE_TIMEOUT")), this.cfg.noResponseTimeoutMs),
      );
      let onErr: (reason: string) => void = () => {};
      const errSignal = new Promise<never>((_, rej) => {
        onErr = (reason: string) => rej(new Error("PROVIDER_ERROR:" + reason));
      });
      const turnTimeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("TURN_TIMEOUT")), this.cfg.turnTimeoutMs || 600000),
      );

      const run = this.prompt(sessionId, text, handlers2, state, onErr);
      try {
        await Promise.race([firstChunk, timeout, errSignal]);
        await Promise.race([run, turnTimeout]); // đợi hoàn tất (có hard cap)
        this.router.succeed();
        return;
      } catch (err) {
        const msg = String(err);
        if (msg.includes("TURN_TIMEOUT")) {
          // Hết thời gian chờ turn (vd: đang chờ user trả lời question). Hủy và kết thúc.
          await this.abort(sessionId).catch(() => {});
          await run.catch(() => {});
          this.router.succeed();
          return;
        }
        const next = this.router.fail();
        onSwitch?.(model.id, next.id, msg.slice(0, 120));
        await this.abort(sessionId).catch(() => {});
        await run.catch(() => {}); // chờ stream/poll cũ dừng hẳn trước khi thử model kế
      }
    }
    throw new Error("All models failed (exhausted fallback attempts)");
  }

  private handleEvent(
    ev: any,
    h: PromptHandlers,
    state: { captured: number },
    onError?: (reason: string) => void,
  ): void {
    log("DEBUG", "sse event", { type: ev?.type, raw: JSON.stringify(ev).slice(0, 400) });
    const o = parseEvent(ev);
    if (!o) return;
    const err = detectError(o);
    if (err) {
      log("WARN", "provider error event", { reason: err.slice(0, 160) });
      onError?.(err);
      return;
    }
    const t = extractTextFromObj(o);
    if (t) {
      state.captured++;
      h.onChunk?.(t);
    }
  }

  private async pollPermissions(
    sessionId: string,
    h: PromptHandlers,
    autoApprove = false,
  ): Promise<void> {
    const res = await (this.client.v2.session as any).permission.list({ sessionID: sessionId });
    const items: PermissionItem[] = (res as any)?.permissions ?? (res as any)?.data?.data ?? [];
    for (const it of items) {
      if (it.id && it.status === "pending") {
        if (this.notifiedPerm.has(it.id)) continue;
        this.notifiedPerm.add(it.id);
        h.onPermission?.({ id: it.id, description: it.description ?? it.tool ?? "permission request" });
        if (autoApprove) {
          log("WARN", "auto-approve permission", { id: it.id, tool: it.tool });
          await this.replyPermission(sessionId, it.id, true).catch(() => {});
        }
      } else if (it.id) {
        this.notifiedPerm.delete(it.id);
      }
    }
  }

  private async pollQuestions(sessionId: string, h: PromptHandlers): Promise<void> {
    const res = await (this.client.v2.session as any).question.list({ sessionID: sessionId });
    const items: QuestionItem[] = (res as any)?.questions ?? (res as any)?.data?.data ?? [];
    for (const it of items) {
      if (it.id) {
        if (this.notifiedQ.has(it.id)) continue;
        this.notifiedQ.add(it.id);
        h.onQuestion?.({ id: it.id, question: it.question ?? "agent asks a question" });
      }
    }
  }

  private async pollTail(
    sessionId: string,
    h: PromptHandlers,
    state: { captured: number },
  ): Promise<void> {
    if (state.captured > 0) return; // đã có chunk rồi -> không gửi trùng
    const res = await (this.client.v2.session as any).messages({ sessionID: sessionId });
    const msgs = (res as any)?.messages ?? (res as any)?.data?.data ?? [];
    for (const m of msgs.slice(-1)) {
      const parts = m?.parts ?? m?.data?.parts ?? [];
      for (const p of parts) if (typeof p?.text === "string" && p.text.length) h.onChunk?.(p.text);
    }
  }

  async replyPermission(sessionId: string, id: string, accept: boolean): Promise<void> {
    await (this.client.v2.session as any)
      .permission.reply({ sessionID: sessionId, requestID: id, reply: accept } as any)
      .catch(async () => {
        await (this.client.permission as any)?.reply?.({ id, accept } as any).catch(() => {});
      });
  }

  async replyQuestion(sessionId: string, id: string, answer: string): Promise<void> {
    await (this.client.v2.session as any)
      .question.reply({ sessionID: sessionId, requestID: id, questionV2Reply: answer } as any)
      .catch(async () => {
        await (this.client.v2.session as any)
          .question.reply({ requestID: id, questionV2Reply: answer } as any)
          .catch(() => {});
      });
  }
}
