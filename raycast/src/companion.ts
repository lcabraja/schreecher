import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ReceiveCallbacks } from "./audio";

export const companionDirectory = join(
  homedir(),
  "Library",
  "Application Support",
  "Screecher",
);
export const companionSocket = join(companionDirectory, "raycast-audio.sock");
export function listenViaCompanion(
  signal: AbortSignal,
  callbacks: ReceiveCallbacks,
) {
  signal.throwIfAborted();
  const socket = connect(companionSocket);
  let pending = "";
  let failed = false;
  const stop = () => socket.destroy();
  signal.addEventListener("abort", stop, { once: true });
  socket.on("connect", () => socket.write('{"type":"listen"}\n'));
  socket.on("data", (data) => {
    if (signal.aborted) return;
    pending += data.toString();
    const lines = pending.split("\n");
    pending = lines.pop()!;
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as {
          type: string;
          message?: string;
          url?: string;
        };
        if (event.type === "link" && event.url) callbacks.received(event.url);
        if (event.type === "status" && event.message)
          callbacks.status(event.message);
        if (event.type === "error") {
          failed = true;
          callbacks.failed(
            new Error(event.message ?? "The audio companion failed."),
          );
          socket.destroy();
        }
      } catch {
        /* Ignore incomplete or unrelated companion events. */
      }
    }
  });
  socket.on("error", () => {
    if (!signal.aborted && !failed) {
      failed = true;
      callbacks.failed(
        new Error(
          "Start the audio companion with bun run companion:start in the repo's raycast folder, then try again.",
        ),
      );
    }
  });
  socket.on("close", () => {
    signal.removeEventListener("abort", stop);
    if (!signal.aborted && !failed)
      callbacks.failed(
        new Error(
          "The audio companion disconnected. Start it again, then resume listening.",
        ),
      );
  });
  return { stop };
}
