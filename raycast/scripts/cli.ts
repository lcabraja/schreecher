import { join } from "node:path";
import { listen, transmit } from "../src/audio";
import { serve } from "./service";
const [command, url] = process.argv.slice(2);
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
async function main() {
  if (command === "send" && url)
    await transmit(url, controller.signal, (part, total) =>
      console.error(`Chirp ${part} of ${total}`),
    );
  else if (command === "serve")
    await serve(
      join(__dirname, "../assets/screecher-audio"),
      controller.signal,
    );
  else if (command === "receive")
    await listen(
      join(__dirname, "../assets/screecher-audio"),
      controller.signal,
      {
        status: (message) => console.error(message),
        received: (url) => console.log(JSON.stringify({ type: "link", url })),
        failed: (error) => {
          console.error(error.message);
          process.exitCode = 1;
        },
      },
    );
  else
    throw new Error(
      'Usage: bun run cli send "https://example.com/" | bun run cli receive | bun run cli serve',
    );
}
main().catch((error) => {
  if (!controller.signal.aborted) {
    console.error(error.message);
    process.exitCode = 1;
  }
});
