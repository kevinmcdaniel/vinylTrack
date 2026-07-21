# vinylTrack

Family record/album/MP3 collection tracker — multiple named collections (Vinyl, Square Dance Calls, General MP3s, …), shared across family members and devices.

See [CLAUDE.md](./CLAUDE.md) for Claude Code operating instructions, [docs/](./docs/README.md) for the human-facing overview (architecture, dev process, design brief), and the [GitHub issues](https://github.com/kevinmcdaniel/vinylTrack/issues) for the full, up-to-date plan.

## Quick start

```bash
cp .env.example .env   # fill in secrets
docker compose up
```

- FE: http://localhost:5201 (docs viewer at `/docs`)
- BE: http://localhost:5202
- Prisma Studio: http://localhost:5203
