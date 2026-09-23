# Greek Parsing Practice

An educational web application for practicing Koine Greek morphological parsing. Load Bible verses, parse each word by selecting its grammatical properties, and receive immediate feedback on your accuracy.

## Features

- Parse one word at a time. A miss explains the contrast, a cue in the verse when there is one, and what that parse does in English
- After the verse is parsed, write an English rendering and compare a gloss line, a parse checklist, and WEB, KJV, and ASV
- Weak spots count repeated misses
- An approved account can ask for a longer tutor note. Every query and reply is stored for `/admin`
- MorphGNT is the grader. The model never overrides a parse

## Tech Stack

- React 19 + TypeScript
- Vite and a Cloudflare Worker (static assets plus `/api`)
- Tailwind CSS for styling
- D1 for accounts, parse attempts, and the tutor log
- KV for cached tutor replies
- Rate limiting bindings for tutor calls, saved attempts, and sign-in emails

## Run it locally

```bash
npm install
npm run dev
```

That applies `migrations/` to a local D1 database under `.wrangler/` and serves the app at `http://localhost:5173`, including `/api`. Parsing, signal cards, weak spots, and the public-domain English versions work without a Cloudflare account. Sign-in stays off until `EMAIL_FROM` is set. The tutor stays off until an account is approved.

Workers AI still calls Cloudflare's remote models during local dev and can spend tokens. Leave the tutor alone unless you mean to.

Checks before a commit:

```bash
npm run lint       # Biome lint + format check
npm run lint:fix   # apply safe fixes and format
npm run typecheck  # tsc -b across app, worker, and config
npm test
```

Biome handles both linting and formatting. TypeScript 7 dropped the JavaScript compiler API, so typescript-eslint cannot run against this project. Hook dependency, array-index key, `any`, and most a11y rules report as warnings for now, so they show up without blocking a commit.

## Put it on Cloudflare

Log in once:

```bash
npx wrangler login
```

The Worker reads two bindings by name. The names are not optional:

| Binding | Resource | What it stores |
| --- | --- | --- |
| `DB` | D1 database `greekparser` | Accounts, sessions, attempts, tutor log. Guests have no rows; their attempts stay in the browser until they sign in |
| `CACHE` | KV namespace | Cached tutor replies |

`wrangler d1 migrations apply` takes the **binding** name, `DB`, not the database name.

### 1. Database

```bash
npx wrangler d1 create greekparser
```

The command prints a `database_id`. If you let Wrangler edit the config, it **appends a second** `d1_databases` entry and leaves the original one alone. The app only reads `env.DB`, and that entry is the one with `"migrations_dir": "migrations"`.

Copy the printed id onto the `DB` entry and delete the extra entry. You want one database:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "greekparser",
    "database_id": "<id printed by d1 create>",
    "migrations_dir": "migrations"
  }
]
```

Then create the tables on that remote database:

```bash
npx wrangler d1 migrations apply DB --remote
```

`--remote` writes to Cloudflare. `npm run dev` already applies the same SQL locally and does not need this command.

If apply fails with `database 00000000-0000-0000-0000-000000000001 could not be found`, the `DB` entry still has the placeholder id from the repo. The id Wrangler appended on the other binding is the real one. Move it, as above, and run apply again.

### 2. Cache

```bash
npx wrangler kv namespace create CACHE
```

Put the printed id on the existing `CACHE` binding. Keep the binding name `CACHE`:

```jsonc
"kv_namespaces": [
  { "binding": "CACHE", "id": "<id printed by kv namespace create>" }
]
```

### 3. Admin and mail

In `wrangler.jsonc` under `vars`:

- `ADMIN_EMAILS` is the allowlist. A comma-separated string or a list of addresses both work. The first time one of those addresses opens a magic link, that account is created as `admin` and `approved`. Any other address is `pending` until you approve it at `/admin`. An address already signed in is promoted on the next request.
- `EMAIL_FROM` is the From address, and its domain has to be onboarded for Email Sending:

```bash
npx wrangler email sending enable example.com
```

Then set `EMAIL_FROM` to something like `greek@example.com`. While it is empty, sign-in returns 503 and the rest of the app still works.

`npm run dev` sends that mail for real, because the `EMAIL` binding has `"remote": true`. Without that flag, Wrangler only prints the link in the terminal. The link points at `localhost`, so open it on this machine.

### 4. Tutor

Tutor calls go through the `AI` binding and an [AI Gateway](https://developers.cloudflare.com/ai-gateway/get-started/). `AI_GATEWAY_ID` is `greekparser`. A gateway with any name other than `default` has to exist before the first call: in the dashboard, open **AI** > **AI Gateway** and create one named `greekparser`. Only the name `default` is created automatically.

`AI_MODEL` picks the model. A Workers AI id such as `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is billed in Neurons on the account. An Anthropic id such as `anthropic/claude-sonnet-5` or `anthropic/claude-opus-5` uses the same binding and needs [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) credits loaded on the gateway. Changing `AI_MODEL` and redeploying is the whole switch. Guests and pending accounts cannot call it. Each approved account has a monthly cap of 20,000 tokens. A call is charged before the model runs, at the prompt size plus the full output allowance, then corrected to the reported usage. If the model reports no usage, the charge stands. The `TUTOR_LIMIT` binding also caps one account at 12 calls a minute, so a burst cannot outrun the cap check. Set a spend budget on the AI Gateway as well; it is the backstop when the app is wrong.

Turnstile is optional and guards only the sign-in flow (sending the magic link and confirming it). Tutor calls skip it: an approved, signed-in account is already vetted and token-capped. Set `TURNSTILE_SITE_KEY` in `vars`, then:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

For local checks, copy `.dev.vars.example` to `.dev.vars`. If the secret is unset, the widget is skipped.

### 5. Deploy

```bash
npm run deploy
```

After you change bindings, refresh the generated Worker types:

```bash
npm run cf-typegen
```

## How It Works

1. Load a verse and tap one word at a time
2. Choose its grammatical features. A miss shows why: the contrast, a cue in the verse when there is one, and what that parse does in English
3. When the selected words are answered, write an English rendering and compare a gloss line, a parse checklist, and WEB, KJV, and ASV
4. Weak spots count repeated misses. An approved account can ask for a longer tutor note; every query and reply is stored for the admin dashboard

## Project Structure

- `src/App.tsx` - Routes for study, reverse parsing, weak spots, and admin
- `src/signals.ts` - Authored explanations for common misses
- `worker/` - Session, tutor, and admin API
- `src/api.ts` - MorphGNT verse loading
- `src/types.ts` - TypeScript definitions for words, verses, and parse fields
- `src/utils.ts` - Scoring logic and field specifications

## Data Sources

Currently uses the MorphGNT API (`https://api.morphgnt.org/v0`) for morphological data. The architecture supports swapping data sources through the adapter layer in `api.ts`

Lexical data is from the [Dodson Greek Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon).