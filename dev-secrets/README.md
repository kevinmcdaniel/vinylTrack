# dev-secrets

Docker secret files for **local dev only** (#65). Committed on purpose, with
obviously fake values, so `docker compose up` works straight after a clone.

| file | mounted at | read via |
|---|---|---|
| `db_password` | `/run/secrets/db_password` | `POSTGRES_PASSWORD_FILE` (db), `DB_PASSWORD_FILE` (be, migrate, seed, studio) |
| `internal_api_secret` | `/run/secrets/internal_api_secret` | `INTERNAL_API_SECRET_FILE` (be, fe): signs/verifies FE→BE tokens |
| `auth_secret` | `/run/secrets/auth_secret` | `AUTH_SECRET_FILE` (fe): encrypts the Auth.js session cookie |
| `turnstile_secret_key` | `/run/secrets/turnstile_secret_key` | `TURNSTILE_SECRET_KEY_FILE` (be): Cloudflare's always-pass **test** secret |
| `automation_key` | `/run/secrets/automation_key` | `AUTOMATION_KEY_FILE` (be): Turnstile automation mode, so the Bruno `auth` checks run locally |

Rules (naming convention in #65):

- File name = secret name: lowercase `snake_case`, owner first (`db_password`,
  `google_oauth_client_secret`). No extension, one value per file, no quotes.
- The app reads secret `<name>` from the path in `<NAME>_FILE`.
- **Never put a real credential here.** Anything that needs one in dev uses the
  dev/automation workaround instead. `be/src/config.ts` refuses to start in
  production on plain-variable secrets and dev-only identities, so these values
  can't end up being what production runs on.
- Production secrets live only on the host, in `/Users/_vinyltrack/secrets/`
  (see `docs/hosting-remote-access.md`).

Postgres only reads the password when it first creates an empty data volume.
If your dev volume predates this file, either reset it
(`docker compose down -v`, which wipes local data and reseeds), or keep the
data and change the password in place:

```bash
docker exec vinyl.db psql -U vinyltrack -d vinyltrack -c "ALTER USER vinyltrack PASSWORD 'dev-only-not-a-secret'"
```
