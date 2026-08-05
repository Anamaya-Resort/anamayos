/**
 * Is the Railway worker alive?
 *
 * The worker upserts video_worker_heartbeat every minute. Everything
 * heavy (proxies, thumbnails, AI tagging, video transcode) runs there,
 * so when it is down the UI would otherwise just sit on "waiting…"
 * forever with no explanation — the exact failure that cost hours
 * during Slice 1. Surfacing this makes a dead worker obvious.
 */
import { createServiceClient } from '@/lib/supabase/server';

/** Two missed beats. Tolerates a redeploy without crying wolf. */
export const STALE_MS = 3 * 60 * 1000;

export type WorkerStatus = {
  online: boolean;
  beatAt: string | null;
  workerName: string | null;
};

export async function getWorkerStatus(): Promise<WorkerStatus> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_worker_heartbeat')
    .select('beat_at, worker_name')
    .maybeSingle();

  if (!data?.beat_at) return { online: false, beatAt: null, workerName: null };
  const age = Date.now() - new Date(data.beat_at).getTime();
  return {
    online: age < STALE_MS,
    beatAt: data.beat_at,
    workerName: data.worker_name ?? null,
  };
}
