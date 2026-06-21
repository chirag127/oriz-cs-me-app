# Oriz CS — Personal site

> Chirag Singhal's personal site — hero, now, uses, CV, contact.

**Live at**: https://me.oriz.in · **Status**: production

## What this is

The personal corner of the oriz family. A small static site for the author's bio, current focus, hardware/software setup, CV, and contact. Exempt from the family-wide monetization rule.

## Per-feature inventory

| Feature | Status |
|---|---|
| `/` hero | ✅ live |
| `/now` current focus (nownownow.com-style) | ✅ live |
| `/uses` hardware + software (uses.tech-style) | ✅ live |
| `/cv` curriculum vitae | ✅ live |
| `/contact` get in touch | ✅ live |
| `/privacy` (links to family-wide policy) | ✅ live |
| Auth mount point | 📜 planned |
| Analytics mount point | 📜 planned |

## App-specific env vars

None beyond the family-wide set at `templates/.env.example`.

## Local dev

```bash
# from the workspace root (c:/D/oriz)
pnpm -F me dev
```

## Knowledge

See [`./knowledge/`](./knowledge/) for app-specific decisions, runbooks, and services. Family rules / decisions / architecture live at the master repo's [`knowledge/`](../../../../knowledge/).

## License

MIT License. See master [`LICENSE`](../../../../LICENSE) — same terms across the family.
