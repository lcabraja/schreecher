# Screecher for Raycast

Search Raycast for **Screecher**, then choose **Send Link**, **Receive Links**, or **Copy Web Link**.

Copy Web Link copies `https://lcabraja.github.io/schreecher/` so you can send the website to another device. Both audio commands also include **Copy Screecher Web Link** in their Command-K action panel.

Send Link loads a valid URL from the clipboard when it opens. Paste another URL or use Load Link from Clipboard, then press Command-Return to share. The form stays open for repeated shares. Press Command-Return again while sending to stop. Keep the receiving device nearby with Screecher listening and turn up the sender's volume.

Receive Links starts when you press Return or Command-L. It catches links continuously and lists them without opening them automatically. Open or copy a selected link through the action panel. Command-L stops listening. Leaving the command stops microphone capture and clears its in-memory link list.

The extension shares `src/transfer.ts` with the website. Short URLs travel directly; URLs over 140 bytes use the same numbered, checksummed packets. The limit is 2048 bytes. Received URLs must pass the same http/https validation. Chirps are audible and not encrypted.

## Install on a Mac

Install Bun and the Xcode Command Line Tools, then run from this repository:

```sh
cd raycast
bun install --frozen-lockfile
bun run dev
```

`package-lock.json` is included for Raycast's CI manifest validation; Bun remains the install and run tool.

The development command compiles a Swift microphone helper, bundles the commands, and installs them into Raycast. After the first successful build, stopping the development watcher keeps the installed commands available. Run it again to install source changes.

## Audio companion

Raycast extensions use Node and do not expose the browser's `getUserMedia` API. A native `AVAudioEngine` helper supplies 48 kHz mono Float32 audio to the ggwave decoder. A companion CLI owns capture and communicates with Raycast through a local Unix socket.

Start the companion from your terminal:

```sh
cd raycast
bun run helper
bun run companion:start
```

Allow microphone access for the terminal if macOS asks. The companion runs in the background, including when Raycast's direct microphone permission is unavailable. Start it again after restarting the Mac. It keeps the microphone off while idle and only captures while Receive Links is connected. The socket directory is private to your macOS user and the socket is mode 0600. Audio is decoded locally and is not stored or uploaded.

Stop the companion with:

```sh
bun run companion:stop
```

For a foreground service with visible status:

```sh
bun run cli serve
```

For standalone sending and receiving without Raycast:

```sh
bun run cli send 'https://example.com/path?q=hello#section'
bun run cli receive
```

The receive CLI emits one JSON object per complete URL on stdout, and status messages on stderr. Control-C stops it. macOS assigns microphone permission to the responsible app, normally your terminal. If capture is denied, enable that app in System Settings > Privacy & Security > Microphone. The helper embeds a microphone usage description for standalone use. The companion log is in `~/Library/Application Support/Screecher/companion.log`.

## Checks

```sh
bun run check
bun run lint
bun run build
cd ..
bun test
```

The root tests cover complete URL transport and the native pipe decoder, including non-aligned pipe chunks, real ggwave waveform decoding, URL reconstruction, and cancellation cleanup. The Swift helper is built for the current Mac architecture and excluded from Git; rebuild it when installing on another Mac. The web app remains a static GitHub Pages build.
