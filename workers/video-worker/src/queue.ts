import { PgBoss } from 'pg-boss';

let _boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  // Parse the URL ourselves — Supabase's shared pooler uses a dotted
  // username (postgres.PROJECTREF) which the pg connection-string parser
  // misroutes as a database name. Passing discrete fields side-steps it.
  const url = new URL(connectionString);
  const boss = new PgBoss({
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6543,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    schema: process.env.PG_BOSS_SCHEMA ?? 'pgboss',
    ssl: { rejectUnauthorized: false },
  });

  boss.on('error', (err: Error) => {
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
