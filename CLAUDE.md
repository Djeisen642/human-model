# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A TypeScript simulation of a group of people. The simulation runs on a yearly basis — every action or event a person participates in happens over one year, and no events within a year affect each other.

## Commands

```bash
# Install dependencies
npm install

# Run tests (Jest via ts-jest)
npm test

# Run a single test file
npx jest src/tests/App/Person.test.ts

# Build (TypeScript → build/)
npm run build

# Lint
npm run lint

# Start development server (nodemon watches src/, runs via ts-node)
npm run start:dev
```

## Architecture

The simulation is driven by a `LooperSingleton` (`src/App/LooperSingleton.ts`) which acts as the entry point and will eventually loop through years of simulation. The entry point (`src/App/index.ts`) simply obtains the singleton and calls `start()`.

**`Person`** (`src/App/Person.ts`) is the core data model. All properties are `readonly` — the class is intentionally immutable. Stats (resources, experience, intelligence, constitution, charisma) and intents (learningIntent, exerciseIntent, stealingIntent, lyingIntent, killingIntent) are all numeric. `happiness` is a computed getter, not a stored field.

**Records** (`src/Records/`) capture events that happen to or are performed by a person:
- `KillingRecord` — tracks who was killed and the murderer's age at the time
- `StealingRecord` — tracks who was stolen from, the amount, and the thief's age
- `DeathRecord` — captures cause of death (from `Constants.CAUSE_OF_DEATH`) and optional killer reference

**Helpers** (`src/Helpers/`) provide shared configuration:
- `Constants` — static enum-like objects for CAUSE_OF_DEATH, EDUCATION levels, and TYPE_OF_HELP
- `Variables` — mutable simulation parameters (illness probability, old age threshold)

Tests mirror the `src/` directory structure under `src/tests/` and use Jest with ts-jest. TypeScript compiles to `build/` with `ES2015` target and CommonJS modules.
