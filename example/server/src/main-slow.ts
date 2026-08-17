import { startSlowExampleServer } from "./app-slow.js";

startSlowExampleServer().catch((err) => {
  console.error("[example-server-slow] fatal:", err);
  process.exit(1);
});
