import factory from "ggwave";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPackets, UrlReceiver } from "../../src/transfer";

type Codec = Awaited<ReturnType<typeof factory>>;
let codecPromise: Promise<Codec> | undefined;
export async function codec() {
  codecPromise ??= factory();
  const module = await codecPromise;
  module.disableLog();
  return module;
}
export function wav(samples: Int8Array): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples.byteLength, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE Float32, matching ggwave's output
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(192000, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples.byteLength, 40);
  return Buffer.concat([header, Buffer.from(samples)]);
}
function aborted() {
  return new Error("Sharing stopped.");
}
function play(path: string, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const child = spawn("/usr/bin/afplay", [path], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let error = "";
    const cancel = () => child.kill("SIGTERM");
    signal.addEventListener("abort", cancel, { once: true });
    child.stderr.on("data", (data) => {
      error += data;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      signal.removeEventListener("abort", cancel);
      if (signal.aborted) reject(aborted());
      else if (code === 0) resolve();
      else reject(new Error(error.trim() || "Audio playback failed."));
    });
  });
}
export async function transmit(
  url: string,
  signal: AbortSignal,
  progress: (part: number, total: number) => void,
) {
  const packets = createPackets(
    url,
    randomUUID().replaceAll("-", "").slice(0, 8),
  );
  const module = await codec();
  signal.throwIfAborted();
  const instance = module.init({
    ...module.getDefaultParameters(),
    sampleRateOut: 48000,
    operatingMode: module.GGWAVE_OPERATING_MODE_TX,
  });
  const directory = await mkdtemp(join(tmpdir(), "screecher-"));
  try {
    for (let index = 0; index < packets.length; index++) {
      signal.throwIfAborted();
      progress(index + 1, packets.length);
      const samples = module
        .encode(
          instance,
          packets[index],
          module.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST,
          40,
        )
        .slice();
      if (!samples.byteLength) throw new Error("Could not create the chirp.");
      const path = join(directory, "chirp.wav");
      await writeFile(path, wav(samples));
      await play(path, signal);
      if (index + 1 < packets.length)
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
  } finally {
    module.free(instance);
    await rm(directory, { recursive: true, force: true });
  }
}

export type ReceiveCallbacks = {
  status: (message: string) => void;
  received: (url: string) => void;
  failed: (error: Error) => void;
};
export async function listen(
  helper: string,
  signal: AbortSignal,
  callbacks: ReceiveCallbacks,
) {
  const module = await codec();
  signal.throwIfAborted();
  const instance = module.init({
    ...module.getDefaultParameters(),
    sampleRateInp: 48000,
    operatingMode: module.GGWAVE_OPERATING_MODE_RX,
  });
  const receiver = new UrlReceiver();
  let pending = Buffer.alloc(0);
  let stderr = "";
  let stopped = false;
  let released = false;
  let lastError = "";
  let failed = false;
  const child: ChildProcess = spawn(helper, [], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const release = () => {
    if (!released) {
      released = true;
      module.free(instance);
    }
  };
  const stop = () => {
    stopped = true;
    child.kill("SIGTERM");
  };
  signal.addEventListener("abort", stop, { once: true });
  child.stdout!.on("data", (chunk: Buffer) => {
    if (stopped || released) return;
    pending = Buffer.concat([pending, chunk]);
    // Native pipes can split Float32 values. Feed only complete 1024-sample frames.
    while (pending.length >= 4096) {
      const frame = pending.subarray(0, 4096);
      pending = pending.subarray(4096);
      try {
        const message = module.decode(
          instance,
          new Int8Array(frame.buffer, frame.byteOffset, frame.byteLength),
        );
        if (!message?.length) continue;
        const result = receiver.accept(new TextDecoder().decode(message));
        if (result.kind === "complete") {
          callbacks.received(result.url);
          callbacks.status("Link received. Still listening.");
        } else if (result.kind === "progress")
          callbacks.status(
            `Caught ${result.received} of ${result.total} chirps. Keep listening.`,
          );
      } catch (error) {
        callbacks.status(
          error instanceof Error
            ? error.message
            : "Could not decode that chirp. Still listening.",
        );
      }
    }
  });
  child.stderr!.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    const lines = stderr.split("\n");
    stderr = lines.pop()!;
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as { type: string; message: string };
        if (event.type === "error") lastError = event.message;
        callbacks.status(event.message);
      } catch {
        if (line.trim()) lastError = line.trim();
      }
    }
  });
  child.on("error", (error) => {
    if (!stopped) {
      failed = true;
      callbacks.failed(
        new Error(
          `Cannot start the audio companion: ${error.message}. Rebuild the extension's helper.`,
        ),
      );
    }
  });
  child.on("close", () => {
    signal.removeEventListener("abort", stop);
    release();
    resolveClosed();
    if (!stopped && !failed)
      callbacks.failed(
        new Error(
          lastError || "The microphone stopped. Start listening again.",
        ),
      );
  });
  return { stop, closed };
}
