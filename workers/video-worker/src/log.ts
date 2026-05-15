import pino from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { worker: process.env.WORKER_NAME ?? 'video-worker' },
});
