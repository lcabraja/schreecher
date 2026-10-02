import { createServer, connect, type Socket } from "node:net";
import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import { companionDirectory, companionSocket } from "../src/companion";
import { listen } from "../src/audio";

export async function serve(helper: string, shutdown: AbortSignal) {
  await mkdir(companionDirectory, { recursive: true, mode: 0o700 });
  await chmod(companionDirectory, 0o700);
  // Refuse to overwrite a regular file, or the socket of a running companion.
  try {
    const existing = await lstat(companionSocket);
    if (!existing.isSocket())
      throw new Error("The companion socket path contains a non-socket file.");
    const running = await new Promise<boolean>((resolve) => {
      const probe = connect(companionSocket);
      probe.on("connect", () => {
        probe.destroy();
        resolve(true);
      });
      probe.on("error", () => resolve(false));
    });
    if (running) {
      console.error("Screecher audio companion is already running.");
      return;
    }
    await unlink(companionSocket);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sessions = new Map<Socket, AbortController>();
  let stop = () => {};
  const server = createServer((client) => {
    let pending = "";
    const write = (type: string, value: string) => {
      if (!client.destroyed)
        client.write(
          JSON.stringify(
            type === "link" ? { type, url: value } : { type, message: value },
          ) + "\n",
        );
    };
    client.on("error", () => client.destroy());
    client.on("data", (data) => {
      pending += data.toString();
      if (pending.length > 256) {
        client.destroy();
        return;
      }
      if (!pending.includes("\n") || sessions.has(client)) return;
      try {
        const request = JSON.parse(pending.split("\n")[0]);
        if (request.type === "shutdown") {
          client.end('{"type":"status","message":"Stopped"}\n');
          stop();
          return;
        }
        if (request.type !== "listen") {
          client.destroy();
          return;
        }
      } catch {
        client.destroy();
        return;
      }
      const controller = new AbortController();
      sessions.set(client, controller);
      write("status", "Starting microphone capture…");
      void listen(helper, controller.signal, {
        status: (message) => write("status", message),
        received: (url) => write("link", url),
        failed: (error) => {
          write("error", error.message);
          controller.abort();
          client.end();
        },
      }).catch((error) => {
        if (!controller.signal.aborted) {
          write("error", error.message);
          client.end();
        }
      });
    });
    client.on("close", () => {
      sessions.get(client)?.abort();
      sessions.delete(client);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(companionSocket, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  await chmod(companionSocket, 0o600);
  console.error(
    `Screecher audio companion ready. Microphone stays off until a receiver connects.\n${companionSocket}`,
  );
  stop = () => {
    for (const [client, controller] of sessions) {
      controller.abort();
      client.destroy();
    }
    server.close(() => {
      void unlink(companionSocket).catch(() => {});
    });
  };
  shutdown.addEventListener("abort", stop, { once: true });
  if (shutdown.aborted) stop();
}
