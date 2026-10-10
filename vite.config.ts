import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vinext({
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@resvg/resvg-js": path.resolve(__dirname, "empty-stub.js"),
      "satori": path.resolve(__dirname, "empty-stub.js"),
      "@/db/runtime": path.resolve(__dirname, "src/db/runtime.worker.ts"),
      "@/lib/r2-runtime": path.resolve(__dirname, "src/lib/r2-runtime.worker.ts"),
      "playwright": path.resolve(__dirname, "empty-stub.js"),
    },
  },
});
