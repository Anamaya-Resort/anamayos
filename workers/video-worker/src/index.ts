import 'dotenv/config';
import { getBoss, stopBoss } from './queue.js';
import { log } from './log.js';

async function main() {
  const boss = await getBoss();
  log.info({ event: 'video-worker online' });

  // Heartbeat — proves the worker is alive. Real job handlers register here
  // as each slice adds them under ./jobs/.
  await boss.schedule('video.heartbeat', '* * * * *', {});
  await boss.work('video.heartbeat', async () => {
    log.debug({ event: 'heartbeat' });
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

main().catch((err) => {
  log.error({ err }, 'fatal worker error');
  process.exit(1);
});
