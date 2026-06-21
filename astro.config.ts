/**
 * astro.config.ts — uses the @chirag127/astro-shell shell() wrapper.
 *
 * The shell provides: output: "static", React 19, MDX, sitemap, Tailwind v4.
 */
import { shell } from '@chirag127/astro-shell/shell'

export default shell({ site: 'https://me.oriz.in' })
