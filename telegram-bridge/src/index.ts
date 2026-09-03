import "dotenv/config";
import { loadConfig } from "./config";
import { setLevel, log } from "./logger";
import { SessionStore } from "./sessionStore";
import { OpencodeBridge } from "./opencodeClient";
import { buildBot } from "./telegramBot";

async function main(): Promise<void> {
  const cfg = loadConfig();
  setLevel(cfg.logLevel);
  log("INFO", "starting opencode telegram bridge (Hermes)");

  if (cfg.allowedUserIds.length === 0) {
    log(
      "ERROR",
      "ALLOWED_USER_IDS empty - bridge rejects everyone (fail-closed). Set your Telegram user ID.",
    );
  }

  const store = new SessionStore(process.env.BRIDGE_STATE_FILE || "./state.json");
  await store.load();

  const bridge = new OpencodeBridge(cfg);
  const healthy = await bridge.health();
  if (!healthy) {
    log(
      "ERROR",
      "cannot reach opencode serve at " + cfg.opencodeServeUrl + " - start it: opencode serve --port 4096",
    );
  } else {
    log("INFO", "connected to opencode serve; model pool size=" + bridge.router.size);
  }

  const bot = buildBot(cfg, bridge, store);

  try {
    await bot.api.setMyShortDescription("🟢 Online - OpenCode bridge");
  } catch {
    /* ignore */
  }

  const shutdown = async (): Promise<void> => {
    log("INFO", "shutting down");
    try {
      await bot.api.setMyShortDescription("🔴 Offline - OpenCode bridge");
    } catch {
      /* ignore */
    }
    await bot.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (cfg.telegramWebhookUrl) {
    if (!cfg.telegramWebhookSecret)
      log("WARN", "TELEGRAM_WEBHOOK_URL set but TELEGRAM_WEBHOOK_SECRET missing");
    await bot.api.setWebhook(cfg.telegramWebhookUrl, { secret_token: cfg.telegramWebhookSecret });
    log("INFO", "telegram webhook set", { url: cfg.telegramWebhookUrl });
  } else {
    log("INFO", "telegram long-polling started");
  }
  await bot.start();
}

main().catch((e) => {
  log("ERROR", "fatal", { error: String(e) });
  process.exit(1);
});
