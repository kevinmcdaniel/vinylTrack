# vinylTrack

Family record/album/MP3 collection tracker — multiple named collections (Vinyl, Square Dance Calls, General MP3s, …), shared across family members and devices.

See [CLAUDE.md](./CLAUDE.md) for Claude Code operating instructions, [docs/](./docs/README.md) for the human-facing overview (architecture, dev process, design brief), and the [GitHub issues](https://github.com/kevinmcdaniel/vinylTrack/issues) for the full, up-to-date plan.

## Quick start

```bash
docker compose up      # no setup: dev secrets are committed fakes in dev-secrets/
```

- FE: http://localhost:5201 (docs viewer at `/docs`)
- BE: http://localhost:5202
- Prisma Studio: http://localhost:5203

Every port listens on `localhost` only (#135). To try the FE from a phone on the same Wi-Fi, set `FE_BIND=0.0.0.0` and `AUTH_URL=http://<this machine's LAN IP>:5201` in `.env` (otherwise sign-in redirects the phone to `localhost`). While it's set, the dev sign-in and the committed fake secrets are open to everyone on that network, so unset it afterwards.
