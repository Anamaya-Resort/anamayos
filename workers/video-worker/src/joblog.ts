/**
 * DB-visible worker logging. pino goes to stdout (Railway only), but
 * video_job_logs is queryable from anywhere — so worker health and
 * crawl progress can be diagnosed without Railway log access.
 * Logging must never throw.
 */
import { db } from './db.js';

export async function dbLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: unknown,
): Promise<void> {
  try {
    await db()
      .from('video_job_logs')
      .insert({
        level,
        message,
        context: context ? JSON.parse(JSON.stringify(context)) : null,
      });
  } catch {
    // swallow — a logging failure must not crash the worker
  }
}
