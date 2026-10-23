import { createApp } from "./app.js";
import { existsSync } from "node:fs";
import path from "node:path";
const envFile = path.resolve(process.cwd(), ".env");
if (existsSync(envFile))
    process.loadEnvFile(envFile);
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
createApp().listen(port, host, () => {
    console.log(`Stillwater API is running at http://${host}:${port}`);
});
