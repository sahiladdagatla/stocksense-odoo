import http from 'node:http';
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { initSocket } from './lib/socket.js';

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  console.log(`StockSense API listening on http://localhost:${env.PORT}`);
});
