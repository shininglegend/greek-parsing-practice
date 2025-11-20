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

- React 18 + TypeScript
- Vite for fast development and building
- Tailwind CSS for styling

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## How It Works

1. Enter a Bible verse reference (e.g., "John 1:1")
2. Each word appears as an expandable card
3. Select morphological properties from dropdowns
4. Submit to see your score
5. Review correct answers highlighted in green, incorrect in red

## Project Structure

- `src/App.tsx` - Main component with state machine and drill interface
- `src/api.ts` - Data fetching and API integration layer
- `src/types.ts` - TypeScript definitions for words, verses, and parse fields
- `src/utils.ts` - Scoring logic and field specifications
- `src/index.css` - Tailwind configuration and custom component styles

## Data Sources

Currently uses the MorphGNT API (`https://api.morphgnt.org/v0`) for morphological data. The architecture supports swapping data sources through the adapter layer in `api.ts`

Lexical data is from the [Dodson Greek Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon).