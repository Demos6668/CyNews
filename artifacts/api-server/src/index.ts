import http from "http";
import { WebSocketServer } from "ws";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../../.env") });
import app from "./app";
import { ensureMasterWorkspace } from "./services/workspaceService";
import { createFeedScheduler } from "./services/feedScheduler";
import { setScheduler } from "./routes/scheduler";

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

wss.on("connection", (ws: { send: (data: string) => void }) => {
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

ensureMasterWorkspace()
  .catch((err) => console.error("Failed to ensure master workspace:", err))
  .then(() => {
    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log(`WebSocket available at ws://localhost:${port}/ws`);
    });
  });
