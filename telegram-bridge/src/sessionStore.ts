import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

export function keyFor(chatType: string, chatId: string | number, threadId?: number): string {
  return `${chatType}:${chatId}${threadId ? `:topic:${threadId}` : ""}`;
}

interface MapFile {
  [k: string]: string;
}

export class SessionStore {
  private cache: MapFile = {};
  constructor(private path: string) {}

  async load(): Promise<void> {
    try {
      if (existsSync(this.path)) {
        const raw = await readFile(this.path, "utf8");
        this.cache = JSON.parse(raw || "{}");
      }
    } catch {
      this.cache = {};
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.cache, null, 2), "utf8");
  }

  get(key: string): string | undefined {
    return this.cache[key];
  }

  async set(key: string, sessionId: string): Promise<void> {
    this.cache[key] = sessionId;
    await this.persist();
  }

  async delete(key: string): Promise<void> {
    delete this.cache[key];
    await this.persist();
  }

  list(): Array<{ key: string; sessionId: string }> {
    return Object.entries(this.cache).map(([key, sessionId]) => ({ key, sessionId }));
  }
}
