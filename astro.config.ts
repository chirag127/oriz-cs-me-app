/**
 * astro.config.ts — re-exports @chirag127/astro-shell defaults with site override.
 *
 * The shell provides: output: "static", React 19, MDX, sitemap, Tailwind v4
 * via Vite plugin. We just override `site` for me.oriz.in.
 */
import { defineConfig } from "astro/config";
import shellConfig from "@chirag127/astro-shell/astro.config";

export default defineConfig({
	...shellConfig,
	site: "https://me.oriz.in",
});
