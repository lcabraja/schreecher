import { describe, expect, test } from "bun:test";
import factory from "ggwave";
import { createPackets, MAX_PACKET_BYTES, UrlReceiver, validateUrl } from "./transfer";

describe("URLs carried entirely over sound", () => {
  test("short URLs travel as the URL itself, including query and fragment", () => {
    const url = "https://example.com/path?q=hello%20world#section";
    expect(createPackets(url)).toEqual([url]);
    expect(new UrlReceiver().accept(url)).toEqual({ kind: "complete", url });
  });
  test("long URLs reassemble out of order, with duplicate chunks and multiple senders", () => {
    const first = "https://example.com/?q=" + "abc123".repeat(50);
    const second = "https://example.org/" + "xy".repeat(100) + "#last";
    const a = createPackets(first, "abcdef01");
    const b = createPackets(second, "abcdef02");
    const receiver = new UrlReceiver();
    expect(a.every(packet => new TextEncoder().encode(packet).length <= MAX_PACKET_BYTES)).toBe(true);
    expect(receiver.accept(a[1]).kind).toBe("progress");
    expect(receiver.accept(a[1]).kind).toBe("progress");
    expect(receiver.accept(b[0]).kind).toBe("progress");
    let result;
    for (const packet of a.toReversed()) result = receiver.accept(packet);
    expect(result).toEqual({ kind: "complete", url: first });
    for (const packet of b.slice(1)) result = receiver.accept(packet);
    expect(result).toEqual({ kind: "complete", url: second });
    expect(receiver.accept(a[0]).kind).toBe("ignored");
  });
  test("Unicode survives UTF-8 transport and unsafe protocols are refused", () => {
    const url = validateUrl("https://example.com/" + "čžš".repeat(30));
    const receiver = new UrlReceiver();
    let result;
    for (const packet of createPackets(url)) result = receiver.accept(packet);
    expect(result).toEqual({ kind: "complete", url });
    expect(() => createPackets("javascript:alert(1)")).toThrow();
    expect(() => createPackets("https://name:password@example.com")).toThrow();
  });
  test("missing packets cannot open a partial URL and corrupted content fails its checksum", () => {
    const packets = createPackets("https://example.com/" + "x".repeat(250), "abcdef03");
    const receiver = new UrlReceiver();
    for (const packet of packets.slice(1)) expect(receiver.accept(packet).kind).toBe("progress");
    const fields = packets[0].split("|");
    fields[5] = btoa("y".repeat(72));
    expect(() => receiver.accept(fields.join("|"))).toThrow("damaged");
  });
  test("actual ggwave waveform decodes direct and multi-chirp URLs", async () => {
    const g = await factory();
    g.disableLog();
    const tx = g.init({ ...g.getDefaultParameters(), operatingMode: g.GGWAVE_OPERATING_MODE_TX });
    const rx = g.init({ ...g.getDefaultParameters(), operatingMode: g.GGWAVE_OPERATING_MODE_RX });
    try {
      for (const url of ["https://example.com/?q=sound#hello", "https://example.com/?q=" + "abc".repeat(55)]) {
        const receiver = new UrlReceiver();
        let result;
        for (const packet of createPackets(url)) {
          const waveform = g.encode(tx, packet, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 40).slice();
          let decoded = "";
          for (let offset = 0; offset < waveform.length; offset += 4096) {
            const data = g.decode(rx, waveform.slice(offset, offset + 4096));
            if (data.length) decoded = new TextDecoder().decode(data);
          }
          expect(decoded).toBe(packet);
          result = receiver.accept(decoded);
          for (let frame = 0; frame < 15; frame++) g.decode(rx, new Int8Array(4096));
        }
        expect(result).toEqual({ kind: "complete", url });
      }
    } finally { g.free(tx); g.free(rx); }
  });
});
