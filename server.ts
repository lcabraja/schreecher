import { join } from "node:path";

// Optional static preview for the existing private Tailscale URL.
// The deployed app needs only built files, with no API or database.
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT || 4386),
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const asset = path === "/" ? "index.html" : decodeURIComponent(path.slice(1));
    if (asset.split("/").includes("..") || asset.startsWith("/")) return new Response("Not found", { status: 404 });
    const file = Bun.file(join(import.meta.dir, "dist", asset));
    return await file.exists() ? new Response(file) : new Response("Not found", { status: 404 });
  },
});
console.log(`Chirp Share static preview at http://127.0.0.1:${server.port}`);
