import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl)
  throw new Error('TEST_DATABASE_URL must be set to run tests (see server/.env.example)');
if (testDbUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: tests wipe their database');
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    env: { NODE_ENV: 'test', DATABASE_URL: testDbUrl },
    globalSetup: ['tests/global-setup.ts'],
    // Tests share one Postgres database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
