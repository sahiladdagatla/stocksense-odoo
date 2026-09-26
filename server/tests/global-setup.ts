import { execSync } from 'node:child_process';

/** Brings the test database schema up to date once before the whole suite. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}
