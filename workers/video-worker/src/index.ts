import 'dotenv/config';
import { getBoss, stopBoss } from './queue.js';
import { log } from './log.js';
import { dbLog } from './joblog.js';
import { scanPendingSources } from './jobs/inventory.js';

async function main() {
  const boss = await getBoss();
  log.info({ event: 'video-worker online' });
  await dbLog('info', 'video-worker online', {
    worker: process.env.WORKER_NAME ?? 'video-worker',
    startedAt: new Date().toISOString(),
  });

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
