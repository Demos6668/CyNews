import http from "http";
import { WebSocketServer } from "ws";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../.env") });
import app from "./app";
import { ensureMasterWorkspace } from "./services/workspaceService";
import { createFeedScheduler } from "./services/feedScheduler";
import { setScheduler } from "./routes/scheduler";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(event: string, data: unknown): void {
  const msg = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client: { readyState: number; send: (data: string) => void }) => {
    if (client.readyState === 1) client.send(msg);
  });
}

const scheduler = createFeedScheduler(broadcast);
setScheduler(scheduler);

// WebSocket heartbeat to detect stale connections
const HEARTBEAT_INTERVAL = 30_000;
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on("close", () => clearInterval(heartbeatTimer));

wss.on("connection", (ws: any) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      data: {
        status: "connected",
        serverTime: new Date().toISOString(),
        nextUpdate: scheduler.getNextUpdateTime(),
      },
    })
  );
});

scheduler.start();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] ${signal} received, shutting down gracefully...`);
  clearInterval(heartbeatTimer);

  wss.clients.forEach((ws: any) => {
    ws.close(1001, "Server shutting down");
  });
  wss.close();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(() => resolve(), 5000); // Force after 5s
  });

  await pool.end().catch(() => {});
  console.log("[Server] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

ensureMasterWorkspace()
  .catch((err) => console.error("Failed to ensure master workspace:", err))
  .then(() => {
    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log(`WebSocket available at ws://localhost:${port}/ws`);
    });
  });
