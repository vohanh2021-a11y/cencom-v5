import { Bot, InlineKeyboard, Context } from "grammy";
import type { Config } from "./config";
import { isUserAllowed, sanitizePrompt } from "./config";
import { SessionStore, keyFor } from "./sessionStore";
import { OpencodeBridge } from "./opencodeClient";
import { log } from "./logger";
import { sendLong } from "./telegramUtils";

export function buildBot(cfg: Config, bridge: OpencodeBridge, store: SessionStore): Bot {
  const bot = new Bot(cfg.telegramBotToken);

  // ACL gate (fail-closed)
  bot.use(async (ctx, next) => {
    const uid = ctx.from?.id;
    if (!isUserAllowed(cfg, uid)) {
      log("WARN", "blocked unauthorized telegram user", { userId: uid });
      await ctx.reply("⛔ Unauthorized.").catch(() => {});
      return;
    }
    await next();
  });

  async function sessionFor(ctx: Context): Promise<string | undefined> {
    const chat = ctx.chat ?? (ctx as any).callbackQuery?.message?.chat;
    if (!chat) return undefined;
    const threadId =
      (ctx as any).message?.message_thread_id ??
      (ctx as any).callbackQuery?.message?.message_thread_id;
    const key = keyFor(chat.type, chat.id, threadId);
    let sid = store.get(key);
    if (!sid) {
      sid = await bridge.createSession();
      await store.set(key, sid);
      log("INFO", "created opencode session", { key, sessionId: sid });
    }
    return sid;
  }

  bot.command("new", async (ctx) => {
    const chat = ctx.chat!;
    const threadId = (ctx as any).message?.message_thread_id;
    const key = keyFor(chat.type, chat.id, threadId);
    const sid = await bridge.createSession();
    await store.set(key, sid);
    await ctx.reply("🔄 New session: `" + sid + "`", { parse_mode: "Markdown" });
  });

  bot.command("status", async (ctx) => {
    const sid = await sessionFor(ctx);
    if (!sid) return;
    try {
      const st = await bridge.status(sid);
      await sendLong(
        bot,
        ctx.chat!.id,
        "📊 Status:\n```\n" + JSON.stringify(st, null, 2).slice(0, 3000) + "\n```",
      );
    } catch (e) {
      await ctx.reply("⚠️ " + String(e).slice(0, 200));
    }
  });

  bot.command("list", async (ctx) => {
    const list = store.list();
    if (!list.length) return ctx.reply("No active sessions.");
    const lines = list.map((s) => "- " + s.key + " → `" + s.sessionId + "`").join("\n");
    await ctx.reply("📋 Sessions:\n" + lines, { parse_mode: "Markdown" });
  });

  bot.command("stop", async (ctx) => {
    const sid = await sessionFor(ctx);
    if (!sid) return;
    await bridge.abort(sid);
    await ctx.reply("🛑 Stop requested.");
  });

  bot.command("models", async (ctx) => {
    const status = bridge.router.status();
    const lines = status
      .map(
        (s) =>
          `${s.healthy ? "🟢" : "🔴"} ${s.id} (${s.provider})${s.healthy ? "" : " cooldown " + s.cooldownSec + "s"}`,
      )
      .join("\n");
    await ctx.reply("🧠 Model pool (auto-switch on failure):\n" + lines);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "*OpenCode Telegram Bridge (Hermes)*\n\n" +
        "/new - new session\n/status - session info\n/list - sessions\n/stop - abort run\n/models - model pool + health\n" +
        "/approve <id> - allow a pending tool\n/reject <id> - deny a pending tool\n" +
        "Text → chat with OpenCode (auto model-switch across zen + b.ai on failure).",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("approve", async (ctx) => {
    const id = ctx.match?.toString().trim();
    if (!id) return ctx.reply("Usage: /approve <id>");
    const sid = await sessionFor(ctx);
    if (!sid) return ctx.reply("No active session.");
    await bridge.replyPermission(sid, id, true);
    await ctx.reply("✅ Approved " + id);
  });

  bot.command("reject", async (ctx) => {
    const id = ctx.match?.toString().trim();
    if (!id) return ctx.reply("Usage: /reject <id>");
    const sid = await sessionFor(ctx);
    if (!sid) return ctx.reply("No active session.");
    await bridge.replyPermission(sid, id, false);
    await ctx.reply("⛔ Rejected " + id);
  });

  bot.on("message:text", async (ctx) => {
    try {
      const chat = ctx.chat!;
      const isGroup = chat.type === "group" || chat.type === "supergroup";
      if (isGroup) {
        if (!cfg.allowedChatIds.includes(String(chat.id))) return;
        if (cfg.requireMention) {
          const text0 = ctx.message.text || "";
          const mentioned =
            text0.includes("@" + (bot.botInfo?.username || "")) ||
            ctx.message.reply_to_message?.from?.is_bot === true;
          const isCommand = text0.startsWith("/");
          if (!mentioned && !isCommand) return;
        }
      }
      const text = sanitizePrompt(ctx.message.text, cfg.maxPromptLen);
      if (!text) return;
      const sid = await sessionFor(ctx);
      if (!sid) return;

      const working = await ctx.reply("⏳ Working…");
      let buffer = "";
      bridge
        .promptWithFallback(
          sid,
          text,
          {
            onChunk: (chunk) => {
              buffer += chunk;
            },
            onPermission: async (p) => {
              const kb = new InlineKeyboard()
                .text("✅ Approve", "approve:" + p.id)
                .text("⛔ Reject", "reject:" + p.id);
              await bot.api.sendMessage(ctx.chat!.id, "🔐 Permission: " + p.description, {
                reply_markup: kb,
              });
            },
            onQuestion: async (q) => {
              await bot.api.sendMessage(
                ctx.chat!.id,
                "❓ Agent asks: " + q.question + " (id " + q.id + ")",
              );
            },
          },
          (from, to, reason) => {
            log("INFO", "auto-switched model", { from, to, reason });
            bot.api
              .sendMessage(ctx.chat!.id, "⚡ Switched " + from + " → " + to + " (auto)")
              .catch(() => {});
          },
        )
        .then(() => {
          if (buffer.trim()) sendLong(bot, ctx.chat!.id, buffer);
          else
            ctx.api
              .editMessageText(ctx.chat!.id, working.message_id, "✅ Done (no text output).")
              .catch(() => {});
        })
        .catch((e) => {
          ctx.reply("⚠️ All models failed: " + String(e).slice(0, 200));
        });
    } catch (e) {
      // Quan trọng: không để lỗi bị nuốt thầm -> luôn reply để user biết lý do.
      log("ERROR", "message handler failed", { error: String(e) });
      await ctx.reply("⚠️ Lỗi xử lý tin nhắn: " + String(e).slice(0, 300)).catch(() => {});
    }
  });

  bot.command("diag", async (ctx) => {
    const healthy = await bridge.health();
    const providers = Array.from(new Set(bridge.router.status().map((s) => s.provider))).join("/");
    const lines = [
      "🔧 Diag Hermes:",
      "- opencode serve: " +
        (healthy
          ? "✅ reachable"
          : "❌ UNREACHABLE — kiểm tra OPENCEDE_SERVE_URL và OPENCEDE_SERVE_TOKEN"),
      "- serve token đã set: " + (cfg.opencodeServeToken ? "yes" : "NO ❗ (bắt buộc)"),
      "- telegram allowed users: " + cfg.allowedUserIds.length,
      "- model pool: " + bridge.router.size + " (" + providers + ")",
      "- current model: " + bridge.router.current.id,
    ];
    await ctx.reply(lines.join("\n"));
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("approve:") || data.startsWith("reject:")) {
      const id = data.split(":")[1];
      const accept = data.startsWith("approve:");
      const sid = await sessionFor(ctx);
      if (sid) await bridge.replyPermission(sid, id, accept);
      await ctx.answerCallbackQuery(accept ? "Approved" : "Rejected");
      await ctx.editMessageText((accept ? "✅ Approved " : "⛔ Rejected ") + id).catch(() => {});
    }
  });

  return bot;
}
