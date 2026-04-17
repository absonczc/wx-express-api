import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger.js";
import { HttpError } from "../../middleware/error.middleware.js";

type JobStatus = "pending" | "completed" | "failed" | "cancelled";

type JobRecord = {
  userId: string;
  status: JobStatus;
  createdAt: number;
  finishedAt?: number;
  /** 仅 `pending` 时存在，用于取消时 `abort()` 中止上游 fetch */
  abort?: AbortController;
  model?: string;
  content?: unknown;
  error?: string;
  details?: unknown;
  /** 与同步接口失败时 HTTP 状态码一致，便于客户端展示 */
  httpStatus?: number;
};

const jobs = new Map<string, JobRecord>();

/** 任务创建后超过此时长则清理（无论是否完成） */
const JOB_TTL_MS = 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000).unref?.();

export function startTravelGuideJob(
  userId: string,
  run: (signal: AbortSignal) => Promise<{ model: string; content: unknown }>
): string {
  const jobId = randomUUID();
  const ac = new AbortController();
  jobs.set(jobId, { userId, status: "pending", createdAt: Date.now(), abort: ac });

  void (async () => {
    try {
      const { model, content } = await run(ac.signal);
      const cur = jobs.get(jobId);
      if (!cur || cur.status !== "pending") return;
      jobs.set(jobId, {
        ...cur,
        status: "completed",
        model,
        content,
        finishedAt: Date.now(),
        abort: undefined,
      });
    } catch (err) {
      const cur = jobs.get(jobId);
      if (!cur || cur.status !== "pending") return;
      if (err instanceof HttpError) {
        jobs.set(jobId, {
          ...cur,
          status: "failed",
          error: err.message,
          details: err.details,
          httpStatus: err.status,
          finishedAt: Date.now(),
          abort: undefined,
        });
      } else {
        logger.error("travel-guide async job failed", err);
        jobs.set(jobId, {
          ...cur,
          status: "failed",
          error: "Internal Server Error",
          httpStatus: 500,
          finishedAt: Date.now(),
          abort: undefined,
        });
      }
    }
  })();

  return jobId;
}

export type CancelTravelGuideJobResult =
  | { outcome: "cancelled" }
  | { outcome: "not_found" }
  | { outcome: "not_pending"; status: Exclude<JobStatus, "pending"> };

/** 取消进行中的任务：`abort()` 中止上游 fetch；已结束则 `not_pending` */
export function cancelTravelGuideJob(jobId: string, userId: string): CancelTravelGuideJobResult {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) {
    return { outcome: "not_found" };
  }
  if (job.status !== "pending") {
    return { outcome: "not_pending", status: job.status };
  }
  job.abort?.abort();
  jobs.set(jobId, {
    ...job,
    status: "cancelled",
    finishedAt: Date.now(),
    abort: undefined,
  });
  return { outcome: "cancelled" };
}

/** 仅创建者可查询；不存在或越权返回 null */
export function getTravelGuideJobForUser(jobId: string, userId: string): JobRecord | null {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) {
    return null;
  }
  return job;
}
