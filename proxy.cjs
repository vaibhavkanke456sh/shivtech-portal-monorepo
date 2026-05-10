const net = require('net');

const VITE_PORT = 3001;
const PROXY_PORT = 3000;

function createProxy(bindHost, label) {
  const server = net.createServer((client) => {
    const target = net.connect(VITE_PORT, '127.0.0.1', () => {
      client.pipe(target);
      target.pipe(client);
    });
    target.on('error', () => client.destroy());
    client.on('error', () => target.destroy());
  });

  server.listen(PROXY_PORT, bindHost, () => {
    console.log(`[proxy] ${label} :${PROXY_PORT} -> 127.0.0.1:${VITE_PORT}`);
  });

  server.on('error', (e) => {
    console.error(`[proxy] ${label} error:`, e.message);
  });
}

createProxy('127.0.0.1', 'IPv4 127.0.0.1');
createProxy('::1', 'IPv6 ::1    ');

console.log('Proxy started. Open http://localhost:3000 in your browser.');
