// Starts the dev server with an in-memory catalog and a test passcode ("test-1234"),
// so changes can be tried without touching the real catalog or code.
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "3002"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, LIBRAT_MEMORY_STORE: "1", APP_PASSCODE: process.env.APP_PASSCODE_TEST || "test-1234" },
});
child.on("exit", (code) => process.exit(code ?? 0));
