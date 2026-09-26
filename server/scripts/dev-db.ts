/**
 * Zero-install local PostgreSQL for development (alternative to docker-compose).
 * Runs a real Postgres binary from the `embedded-postgres` package, with data kept in server/.pgdata.
 * Keep this process running while you develop. Press Ctrl+C to stop it.
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(here, '../.pgdata');
const firstRun = !fs.existsSync(databaseDir);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'stocksense',
  password: 'stocksense',
  port: 5432,
  persistent: true,
});

async function ensureDatabase(name: string) {
  try {
    await pg.createDatabase(name);
    console.log(`  created database "${name}"`);
  } catch {
    // Already exists.
  }
}

async function main() {
  if (firstRun) {
    console.log('Initialising embedded Postgres cluster (first run)…');
    await pg.initialise();
  }
  await pg.start();
  await ensureDatabase('stocksense');
  await ensureDatabase('stocksense_test');
  console.log(
    'Embedded Postgres running on localhost:5432 (user/pass: stocksense). Ctrl+C to stop.',
  );

  const shutdown = async () => {
    console.log('\nStopping Postgres…');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (err: unknown) => {
  console.error(err);
  await pg.stop().catch(() => undefined);
  process.exit(1);
});
