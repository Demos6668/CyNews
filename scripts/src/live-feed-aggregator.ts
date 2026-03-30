/**
 * Live Feed Aggregator - CLI entry point.
 * Run: pnpm --filter @workspace/scripts run live-feed
 * For continuous mode: pnpm --filter @workspace/scripts run live-feed -- --watch
 */

import { runFeedUpdate } from "@workspace/feed-aggregator";

const watchMode = process.argv.includes("--watch");
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runOnce(): Promise<void> {
  console.log("=== Live Feed Aggregator ===\n");
  await runFeedUpdate();
  console.log("\nDone.");
}

if (watchMode) {
  console.log("Watch mode: running every 15 minutes.");
  runOnce().catch(console.error);
  setInterval(() => runOnce().catch(console.error), INTERVAL_MS);
} else {
  runOnce().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
