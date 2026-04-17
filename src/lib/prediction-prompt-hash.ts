import { createHash } from "node:crypto";

/**
 * 与 PostgreSQL `md5(prompt::text)` 一致（UTF-8 字节序列），用于 `promptHash` 列与索引。
 * 仅作缓存键，非安全场景；避免在 `prompt` 全文上建 B-tree 导致超长索引项报错 54000。
 */
export function predictionPromptCacheHash(prompt: string): string {
  return createHash("md5").update(prompt, "utf8").digest("hex");
}
