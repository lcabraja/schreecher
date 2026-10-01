export const MAX_URL_BYTES = 2048;
export const MAX_PACKET_BYTES = 140;
const CHUNK_BYTES = 72;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function validateUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Enter a full http or https link."); }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Use an http or https link without a username or password.");
  }
  const normalized = url.toString();
  if (encoder.encode(normalized).length > MAX_URL_BYTES) throw new Error(`Links can be up to ${MAX_URL_BYTES} bytes long.`);
  return normalized;
}

function checksum(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

export function createPackets(input: string, id = crypto.randomUUID().replaceAll("-", "").slice(0, 8)): string[] {
  const url = validateUrl(input);
  const bytes = encoder.encode(url);
  if (bytes.length <= MAX_PACKET_BYTES) return [url];
  const total = Math.ceil(bytes.length / CHUNK_BYTES);
  const hash = checksum(bytes);
  return Array.from({ length: total }, (_, index) => {
    const chunk = bytes.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
    const data = btoa(String.fromCharCode(...chunk));
    return `SC1|${id}|${index.toString(36)}|${total.toString(36)}|${hash}|${data}`;
  });
}

export type Reception = { kind: "complete"; url: string } | { kind: "progress"; received: number; total: number } | { kind: "ignored" };
type Transfer = { chunks: Map<number, Uint8Array>; total: number; hash: string; updatedAt: number };

export class UrlReceiver {
  private transfers = new Map<string, Transfer>();
  private completed = new Map<string, number>();
  private lastDirect = "";
  private lastDirectAt = 0;

  accept(message: string, now = Date.now()): Reception {
    for (const [id, transfer] of this.transfers) if (now - transfer.updatedAt > 600_000) this.transfers.delete(id);
    for (const [id, at] of this.completed) if (now - at > 600_000) this.completed.delete(id);
    if (/^https?:\/\//i.test(message)) {
      const url = validateUrl(message);
      if (url === this.lastDirect && now - this.lastDirectAt < 1000) return { kind: "ignored" };
      this.lastDirect = url;
      this.lastDirectAt = now;
      return { kind: "complete", url };
    }
    const match = /^SC1\|([0-9a-f]{8})\|([0-9a-z]{1,2})\|([0-9a-z]{1,2})\|([0-9a-f]{8})\|([A-Za-z0-9+/]+={0,2})$/.exec(message);
    if (!match || encoder.encode(message).length > MAX_PACKET_BYTES) return { kind: "ignored" };
    const [, id, indexText, totalText, hash, data] = match;
    if (this.completed.has(id)) return { kind: "ignored" };
    const index = parseInt(indexText, 36);
    const total = parseInt(totalText, 36);
    if (total < 2 || total > Math.ceil(MAX_URL_BYTES / CHUNK_BYTES) || index >= total) return { kind: "ignored" };
    let chunk: Uint8Array;
    try { chunk = Uint8Array.from(atob(data), char => char.charCodeAt(0)); } catch { return { kind: "ignored" }; }
    if (chunk.length === 0 || chunk.length > CHUNK_BYTES || (index !== total - 1 && chunk.length !== CHUNK_BYTES)) return { kind: "ignored" };
    let transfer = this.transfers.get(id);
    if (transfer && (transfer.total !== total || transfer.hash !== hash)) return { kind: "ignored" };
    if (!transfer) {
      if (this.transfers.size >= 32) this.transfers.delete(this.transfers.keys().next().value!);
      transfer = { chunks: new Map(), total, hash, updatedAt: now };
      this.transfers.set(id, transfer);
    }
    transfer.chunks.set(index, chunk);
    transfer.updatedAt = now;
    if (transfer.chunks.size < total) return { kind: "progress", received: transfer.chunks.size, total };
    const bytes = new Uint8Array(Array.from(transfer.chunks.values()).reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (let part = 0; part < total; part++) {
      const value = transfer.chunks.get(part)!;
      bytes.set(value, offset);
      offset += value.length;
    }
    this.transfers.delete(id);
    if (checksum(bytes) !== hash) throw new Error("Some chirps were damaged. Ask the sender to share again.");
    const url = validateUrl(decoder.decode(bytes));
    this.completed.set(id, now);
    return { kind: "complete", url };
  }
}
