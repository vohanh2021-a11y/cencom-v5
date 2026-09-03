import { Bot } from "grammy";

const MAX_TG_MSG = 4000;

/** Telegram giới hạn 4096 ký tự/tin nhắn. Chia nhỏ và gửi tuần tự. */
export async function sendLong(bot: Bot, chatId: number | string, text: string): Promise<void> {
  let remaining = text;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, MAX_TG_MSG);
    remaining = remaining.slice(MAX_TG_MSG);
    await bot.api
      .sendMessage(chatId, chunk, { parse_mode: "Markdown" })
      .catch(() => bot.api.sendMessage(chatId, chunk));
  }
}
