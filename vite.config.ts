import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vinext({
      images: { optimizer: imagesOptimizer() },
      // KV-backed ISR + data cache. Required because src/app/page.tsx and
      // src/app/events/page.tsx both use `export const revalidate`. Without
      // this, `vinext-cloudflare deploy` refuses to ship.
      cache: { data: kvDataAdapter() },
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
