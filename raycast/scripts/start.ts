import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { companionDirectory, companionSocket } from "../src/companion";
async function running() {
  return new Promise<boolean>((resolve) => {
    const socket = connect(companionSocket);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}
async function main() {
  if (await running()) {
    console.log("Screecher audio companion is already running.");
    return;
  }
  if (!existsSync(join(__dirname, "../assets/screecher-audio")))
    throw new Error("Build the native helper first: bun run helper");
  mkdirSync(companionDirectory, { recursive: true, mode: 0o700 });
  const log = openSync(join(companionDirectory, "companion.log"), "a", 0o600);
  const child = spawn(process.execPath, [join(__dirname, "cli.ts"), "serve"], {
    cwd: join(__dirname, ".."),
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  closeSync(log);
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await running()) {
      console.log(
        "Screecher audio companion started. It records only while a receiver is connected.",
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Companion did not start. See ${join(companionDirectory, "companion.log")}`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
