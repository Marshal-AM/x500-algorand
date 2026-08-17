import { startExampleServer } from "./app.js";

startExampleServer().catch((err) => {
  console.error("[example-server] fatal:", err);
  process.exit(1);
});
