// Starts the dev server with an in-memory catalog, so changes can be tried without touching
// the real catalog. Any email and password sign in.
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "3002"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, LIBRAT_MEMORY_STORE: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
