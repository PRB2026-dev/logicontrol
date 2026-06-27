// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Force the nitro deploy plugin to run and target Netlify. Without an explicit
  // `nitro` option the Lovable config skips nitro entirely outside its own sandbox,
  // so a Netlify deploy only gets static client assets (no SSR server handler and
  // no index.html) and fails to publish. The `netlify` preset emits the static site
  // plus a Netlify Function at `.netlify/functions-internal/server` to serve SSR.
  nitro: { preset: "netlify" },
});
