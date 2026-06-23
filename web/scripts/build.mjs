import { spawn } from "node:child_process";
import { generateFumadocsSource } from "./generate-fumadocs-source.mjs";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`));
    });
  });
}

await generateFumadocsSource();

const env = {
  ...process.env,
  _FUMADOCS_MDX: "1",
};

await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env });
await run(process.execPath, ["scripts/postbuild-og.mjs"], { env });
