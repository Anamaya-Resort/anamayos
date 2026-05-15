import PgBoss from 'pg-boss';

let _boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  const boss = new PgBoss({
    connectionString,
    schema: process.env.PG_BOSS_SCHEMA ?? 'pgboss',
    retentionDays: 14,
    archiveCompletedAfterSeconds: 60 * 60 * 24,
  });
  boss.on('error', (err) => {
    console.error('[pg-boss]', err);
  });
  await boss.start();
  _boss = boss;
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (_boss) {
    await _boss.stop({ graceful: true });
    _boss = null;
  }
}
