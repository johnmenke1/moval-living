import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "moval-living",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-10",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      AUTH_SECRET: bindings.secret(),
      AUTH_URL: bindings.secret(),
      AUTH_TRUST_HOST: bindings.secret(),
      DATABASE_URL: bindings.secret(),
      R2_PUBLIC_URL: bindings.secret(),
      MEDIA: bindings.r2({ name: "moval-media" }),
      HYPERDRIVE: bindings.hyperdrive({ id: "local-spike", dev: { connectionString: "postgres://test:test@127.0.0.1:54330/spike" } }),
    },
  }),
});
