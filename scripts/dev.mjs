import { spawn } from "node:child_process";
const commands = [
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    "8787",
  ],
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--strictPort"],
];
const children = commands.map((args) =>
  spawn(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      XDG_CONFIG_HOME:
        process.env.XDG_CONFIG_HOME ?? `${process.cwd()}/work/config`,
    },
  }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
