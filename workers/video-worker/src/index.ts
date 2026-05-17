import 'dotenv/config';
import { getBoss, stopBoss } from './queue.js';
import { log } from './log.js';
import { dbLog } from './joblog.js';
import { scanPendingSources } from './jobs/inventory.js';
import { processPendingAssets, reclaimOrphanedProxies } from './jobs/proxy.js';
import { analyzePendingAssets, reclaimOrphanedAnalysis } from './jobs/analyze.js';
import { processPendingVideos } from './jobs/video-proxy.js';
import { analyzePendingVideos } from './jobs/video-segment.js';

async function main() {
  const boss = await getBoss();
  log.info({ event: 'video-worker online' });
  await dbLog('info', 'video-worker online', {
    worker: process.env.WORKER_NAME ?? 'video-worker',
    startedAt: new Date().toISOString(),
  });

  // Heal any claims orphaned by the previous instance's shutdown.
  await reclaimOrphanedProxies();
  await reclaimOrphanedAnalysis();

  // pg-boss 12 requires queues to be created before scheduling/working.
  // Heartbeat — proves the worker is alive.
  await boss.createQueue('video.heartbeat');
  await boss.schedule('video.heartbeat', '* * * * *', {});
  await boss.work('video.heartbeat', async () => {
    log.debug({ event: 'heartbeat' });
  });

  // Inventory poller — every minute, claim any video_drive_sources
  // rows the app marked scan_status='pending' and crawl them.
  await boss.createQueue('video.scan_pending_sources');
  await boss.schedule('video.scan_pending_sources', '* * * * *', {});
  await boss.work('video.scan_pending_sources', async () => {
    await scanPendingSources();
  });

  // Proxy/thumbnail poller — every minute, process a batch of
  // assets whose proxy_status is still 'pending'.
  await boss.createQueue('video.process_pending_assets');
  await boss.schedule('video.process_pending_assets', '* * * * *', {});
  await boss.work('video.process_pending_assets', async () => {
    await processPendingAssets();
  });

  // Vision tagging poller — every minute, run AI analysis on a small
  // batch of proxied image assets (analysis_status='pending').
  await boss.createQueue('video.analyze_pending_assets');
  await boss.schedule('video.analyze_pending_assets', '* * * * *', {});
  await boss.work('video.analyze_pending_assets', async () => {
    await analyzePendingAssets();
  });

  // Video proxy poller — every 2 min, transcode a small batch of
  // pending VIDEO assets (ffmpeg; heavier, so less frequent).
  await boss.createQueue('video.process_pending_videos');
  await boss.schedule('video.process_pending_videos', '*/2 * * * *', {});
  await boss.work('video.process_pending_videos', async () => {
    await processPendingVideos();
  });

  // Video segment poller — every 2 min, scene-sample + vision-tag
  // one proxied video into timecoded segments.
  await boss.createQueue('video.analyze_pending_videos');
  await boss.schedule('video.analyze_pending_videos', '*/2 * * * *', {});
  await boss.work('video.analyze_pending_videos', async () => {
    await analyzePendingVideos();
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ event: 'shutdown', signal });
    await stopBoss();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch(async (err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error('[FATAL]', e.message);
  console.error(e.stack);
  log.error({ err: { message: e.message, stack: e.stack } }, 'fatal worker error');
  await dbLog('error', 'fatal worker error', { message: e.message, stack: e.stack });
  process.exit(1);
});
