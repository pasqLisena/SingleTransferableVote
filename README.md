# SingleTransferableVote

Vote processing utilities for FPTP and STV plus a lightweight browser UI.

## Install

```bash
npm install
```

## Run tests

```bash
npm test
```

## Web app (GitHub Pages)

The web app UI is in `docs/` and uses shared logic from `src/` (no duplicated vote model code).
A root `index.html` redirects to `docs/index.html` so GitHub Pages can publish from repository root.

Features:

- Upload votes file (`.csv` or `.xlsx`)
- Upload optional token file (`.csv` or `.txt`)
- Auto-detect configuration (token/timestamp + STV/FPTP questions)
- Let users edit question type and STV seat count before processing
- Print plain verbalization output lines
- Toggle verbose lines on/off

### Publish steps

1. Push this repository to GitHub.
2. In repository settings, open **Pages**.
3. Set **Source** to deploy from branch `main` and folder `/` (root).
4. Save. The app will be available at your GitHub Pages URL.

## Programmatic usage

Core functions are exported from `src/index.js`:

- `importVotes(votefile)`
- `selectValidVotes(votefile, tokenfile)`
- `processVotes(votes)`
- `getVerbalization(includeVerbose)`
- `formatVerbalizationOutput(includeVerbose)`
