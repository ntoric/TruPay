// Tiny TCP proxy: forwards all HTTP + WebSocket traffic from port 6000 -> 6001.
// Works around Next.js refusing to bind reserved port 6000 (X11).
const net = require("net");

const FROM = 6000;
const TO = 6001;

const server = net.createServer((client) => {
  const upstream = net.connect(TO, "127.0.0.1");
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  client.pipe(upstream);
  upstream.pipe(client);
});

server.on("error", (err) => {
  console.error("proxy error:", err.message);
  process.exit(1);
});

server.listen(FROM, "0.0.0.0", () => {
  console.log(`proxy listening on :${FROM} -> 127.0.0.1:${TO}`);
});
