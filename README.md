# Greek Parsing Practice

An educational web application for practicing Koine Greek morphological parsing. Load Bible verses, parse each word by selecting its grammatical properties, and receive immediate feedback on your accuracy.

## Features

- **Interactive drill interface**: Load any verse and parse words one by one
- **Comprehensive morphology**: Parse 8 grammatical fields per word:
  - Part of speech
  - Case
  - Number
  - Gender
  - Tense
  - Voice
  - Mood
  - Person
- **Instant feedback**: Color-coded scoring shows correct/incorrect answers
- **Real linguistic data**: Uses MorphGNT API for gold-standard morphological analysis

## Tech Stack

- React 19 + TypeScript
- Vite and a Cloudflare Worker (static assets plus `/api`)
- Tailwind CSS for styling
- D1 for accounts, parse attempts, and the tutor log
- KV for cached English verses and cached tutor replies

## Getting Started

```bash
npm install
npm run dev
```

`npm run dev` applies the local D1 migrations, then starts Vite. The app is served by the Worker, including `/api`.

Before the first deploy, create the remote database and KV namespace and replace the placeholder ids in `wrangler.jsonc`:

```bash
npx wrangler d1 create greekparser
npx wrangler kv namespace create CACHE
npx wrangler d1 migrations apply DB --remote
```

Set `ADMIN_EMAILS` to the addresses that should be admins, and `EMAIL_FROM` to a sender on a domain onboarded to Email Sending. An optional Turnstile secret (`TURNSTILE_SECRET`, via `wrangler secret put`) and `TURNSTILE_SITE_KEY` gate tutor calls and magic links. `npm run deploy` publishes the Worker. GitHub Pages is no longer the host.

## How It Works

1. Load a verse and tap one word at a time
2. Choose its grammatical features. A miss shows why: the contrast, a cue in the verse when there is one, and what that parse does in English
3. When the selected words are answered, write an English rendering and compare a gloss line, a parse checklist, and WEB, KJV, and ASV
4. Weak spots count repeated misses. An approved account can ask for a longer tutor note; every query and reply is stored for the admin dashboard

## Project Structure

- `src/App.tsx` - Routes for study, reverse parsing, weak spots, and admin
- `src/signals.ts` - Authored explanations for common misses
- `worker/` - Session, translations, tutor, and admin API
- `src/api.ts` - MorphGNT verse loading
- `src/types.ts` - TypeScript definitions for words, verses, and parse fields
- `src/utils.ts` - Scoring logic and field specifications

## Data Sources

Currently uses the MorphGNT API (`https://api.morphgnt.org/v0`) for morphological data. The architecture supports swapping data sources through the adapter layer in `api.ts`

Lexical data is from the [Dodson Greek Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon).