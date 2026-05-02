import { spawn } from "node:child_process";

const processes = [
  {
    name: "api",
    command: process.execPath,
    args: ["server/local-api.mjs"]
  },
  {
    name: "vite",
    command: process.execPath,
    args: ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173"]
  }
];

const children = processes.map((processConfig) => {
  const child = spawn(processConfig.command, processConfig.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${processConfig.name}] exited with code ${code}`);
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
