import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { codec, listen, wav } from "../src/audio";
import { createPackets } from "../../src/transfer";

test("native pipe fragments decode a complete long URL and stop cleanly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "screecher-pipe-test-"));
  const module = await codec();
  const tx = module.init({
    ...module.getDefaultParameters(),
    operatingMode: module.GGWAVE_OPERATING_MODE_TX,
  });
  const controller = new AbortController();
  let session: Awaited<ReturnType<typeof listen>> | undefined;
  try {
    const url = "https://example.com/?q=" + "screecher".repeat(20) + "#intact";
    const pieces: Buffer[] = [];
    for (const packet of createPackets(url, "abcd1234")) {
      const audio = module
        .encode(tx, packet, module.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 40)
        .slice();
      const wave = wav(audio);
      expect(wave.toString("ascii", 0, 4)).toBe("RIFF");
      expect(wave.readUInt16LE(20)).toBe(3);
      expect(wave.readUInt32LE(24)).toBe(48000);
      expect(wave.readUInt32LE(40)).toBe(audio.length);
      expect(wave.subarray(44)).toEqual(Buffer.from(audio));
      pieces.push(wave.subarray(44), Buffer.alloc(4096 * 15));
    }
    const pcm = join(directory, "sample.pcm");
    await writeFile(pcm, Buffer.concat(pieces));
    const helper = join(directory, "fake-microphone");
    await writeFile(
      helper,
      `#!/usr/bin/env node
const fs = require('node:fs');
const audio = fs.readFileSync(${JSON.stringify(pcm)});
console.error(JSON.stringify({ type: 'ready', message: 'Test microphone ready' }));
let offset = 0;
const hold = setInterval(() => {}, 1000);
function emit() {
  if (offset >= audio.length) return;
  const next = Math.min(offset + 4099, audio.length);
  process.stdout.write(audio.subarray(offset, next)); offset = next;
  setImmediate(emit);
}
emit();
`,
      { mode: 0o700 },
    );
    const urls: string[] = [];
    const complete = Promise.withResolvers<string>();
    session = await listen(helper, controller.signal, {
      status: () => {},
      received: (received) => {
        urls.push(received);
        complete.resolve(received);
      },
      failed: (error) => complete.reject(error),
    });
    expect(await complete.promise).toBe(url);
    expect(urls).toEqual([url]);
    controller.abort();
    await session.closed;
  } finally {
    controller.abort();
    await session?.closed;
    module.free(tx);
    await rm(directory, { recursive: true, force: true });
  }
}, 10000);
