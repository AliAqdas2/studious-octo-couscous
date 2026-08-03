import { config } from "dotenv";
import { createServer } from "http";
import { createApp } from "./app/createApp.js";
import { logDatabaseStartup, warnIfNoDatabase } from "./db/index.js";
import { startJobs } from "./jobs/startJobs.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { serveStatic } from "./static.js";

config();

warnIfNoDatabase();
await logDatabaseStartup();

const app = createApp();
const port = Number(process.env.PORT) || 5000;
const server = createServer(app);

// Use process.env.NODE_ENV (not app.get("env")) so production esbuild can
 // tree-shake the Vite import and keep `vite` out of the Docker image.
const isDev = process.env.NODE_ENV === "development";
if (isDev) {
  const { setupVite } = await import("./vite.js");
  await setupVite(app, server);
} else {
  serveStatic(app);
}

app.use(errorHandler);

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${port}`);
  startJobs();
});
