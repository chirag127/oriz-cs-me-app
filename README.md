# me

Source for **me.oriz.in** — Chirag Singhal's personal site.

Built on [`@chirag127/astro-shell`](https://github.com/chirag127/astro-shell)
(Astro 6 · React 19 · Tailwind v4). Static output, deployed at
**https://me.oriz.in**.

## Pages

- `/`        — hero
- `/now`     — current focus ([nownownow.com](https://nownownow.com)-style)
- `/uses`    — hardware + software ([uses.tech](https://uses.tech)-style)
- `/cv`      — curriculum vitae
- `/contact` — get in touch
- `/privacy` — links to the family-wide policy at `oriz.in/privacy`

## Family rules in effect

- **No auth** — auth lives in `@chirag127/astro-chrome` (not yet shipped).
  `BaseLayout.astro` carries a TODO marking the future mount point.
- **No monetization** — `me.oriz.in` is the personal site and is exempt from
  the family monetization rule.
- **No analytics** — analytics also lives in `astro-chrome`.

## Develop

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm build
```

## License

Source-available. See `LICENSE`.
