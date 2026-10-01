# Chirp Share

Share an entire URL between nearby devices through audible chirps. Everything runs in the browser with [ggwave](https://github.com/ggerganov/ggwave). There is no link lookup server, database, or expiry.

Choose Transmit, paste an http or https URL, and press Share. On another device, choose Receive and allow microphone access. Keep the receiving page open and the devices close. Turn up the sender's speaker volume. Received links stay in memory until the page closes or reloads.

URLs up to 140 UTF-8 bytes travel as a single chirp. Longer URLs, up to 2048 bytes, use numbered packets and a checksum. The receiver only adds the URL once every packet has arrived and the checksum matches. Long links take longer to send; if a chirp is missed, share again. Sound is audible to anyone nearby and is not encrypted.

## Develop and build

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun test
bun run build
```

Publish `dist/` on any static HTTPS host. The build uses relative paths, so it also works under a GitHub Pages repository path. HTTPS is required for microphone access, except on localhost. Once the page and audio engine have loaded, sending and receiving make no network requests.

`bun run start` serves the build on `127.0.0.1:4386` for the existing Tailscale preview. It provides no backend API.
