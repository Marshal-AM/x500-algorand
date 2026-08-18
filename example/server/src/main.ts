import { startExampleServer } from "./app.js";
import { startSlowExampleServer } from "./app-slow.js";

const slow = process.env.EXAMPLE_SERVER_MODE?.trim() === "slow";
const start = slow ? startSlowExampleServer : startExampleServer;

start().catch((err) => {
  console.error(`[example-server${slow ? "-slow" : ""}] fatal:`, err);
  process.exit(1);
});
