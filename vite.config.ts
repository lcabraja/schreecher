import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

export default defineConfig({
  base: "./",
  plugins: [{
    name: "third-party-notices",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "THIRD_PARTY_NOTICES.txt", source: readFileSync(new URL("./THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8") });
    },
  }],
});
