import http from 'node:http';
import { createApp } from './app.js';
import { env } from './lib/env.js';

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`StockSense API listening on http://localhost:${env.PORT}`);
});
