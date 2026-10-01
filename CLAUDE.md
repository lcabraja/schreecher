# Project instructions

This is a static Vite and TypeScript app. Use Bun for tooling. Preserve the existing stack.

The full URL travels through ggwave audio. Short URLs fit in one chirp, and longer URLs use numbered chunks with a checksum. Do not introduce a server, API, external URL shortener, or link database.

`src/transfer.ts` owns the wire format and reassembly. `src/main.ts` owns the browser controls and audio lifecycle. `src/style.css` owns the interface design. `server.ts` is only a local static preview.

Run `bun run check`, `bun test`, and `bun run build` after changes. Preserve safe URL validation, repeatable sending, continuous receiving, microphone cleanup, cancellation, and relative paths for GitHub Pages.

You are sharing this workspace with another agent. Do not revert others' work. Only edit files assigned in the current task. Do not create commits or publish without explicit instructions.
