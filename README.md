# Privacy-Preserving Browser Agent — Phase 1

> Local page perception — extracts a structured, typed representation of a webpage entirely in-browser, with no AI and no network calls.

## What This Does

A Chrome extension (Manifest V3) that:

- Runs a content script on any webpage
- On demand (click "Analyze"), extracts a structured representation of the page's DOM
- Displays the extraction results in a side panel UI
- Lets you click any extracted element to highlight it on the live page
- Does all of this with **zero network calls, zero backend, zero AI/ML**

## Requirements

- **Chrome 114+** (required for `chrome.sidePanel` API)
- **Node.js 18+** (for building the extension)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Build the extension

```bash
npm run build
```

This produces a `dist/` folder with the built extension.

### 3. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project
5. The extension icon appears in your toolbar

### 4. Launch the demo site

```bash
npm run demo
```

This serves the demo flight-booking site at `http://localhost:3000`. Open that URL in Chrome.

### 5. Use the extension

1. Navigate to the demo site (or any webpage)
2. Click the extension icon (🛡️) to open the side panel
3. Click **🔍 Analyze Current Page**
4. Browse extracted elements in the inspector
5. Click any element to highlight it on the live page

## Project Structure

```
src/
├── background/
│   └── serviceWorker.ts        # Message router only
├── content/
│   ├── contentScript.ts        # Entry point, wires up message listener
│   ├── domExtractor.ts         # Pure extraction logic
│   ├── elementUtils.ts         # Visibility/clickability/ID helpers
│   └── highlighter.ts          # Non-destructive highlight overlay
├── sidepanel/
│   ├── App.tsx                 # Main orchestrator
│   ├── index.tsx               # React entry point
│   ├── index.html              # Side panel HTML
│   ├── components/
│   │   ├── PageOverview.tsx    # Page title, URL, summary counts
│   │   ├── ElementInspector.tsx # Scrollable element list with filters
│   │   └── AnalyzeButton.tsx   # Analysis trigger button
│   └── styles/
│       └── panel.css           # Side panel styles
├── shared/
│   ├── types.ts                # PageRepresentation, PageElement
│   ├── messages.ts             # Discriminated-union message contracts
│   └── constants.ts            # Shared constants
├── demo/
│   └── flight-booking/         # Synthetic demo site
│       ├── index.html
│       ├── styles.css
│       └── script.js
└── manifest.json               # Manifest V3 configuration
```

## Tech Stack

- **Manifest V3** (`manifest_version: 3`)
- **TypeScript** (strict mode)
- **Vite** + **@crxjs/vite-plugin** (MV3-aware bundling)
- **React** (side panel UI only — content scripts are framework-free)
- **chrome.sidePanel API** (Chrome 114+)
- No backend, no database, no external API SDKs

## Data Flow

```
Side Panel → Background → Content Script → domExtractor → PageRepresentation → Background → Side Panel
```

1. User clicks "Analyze Current Page"
2. Side panel sends `ANALYZE_PAGE` message to background
3. Background routes message to active tab's content script
4. Content script runs `extractPageRepresentation()` (pure DOM traversal)
5. Returns `PAGE_ANALYSIS_RESULT` with typed `PageRepresentation`
6. Side panel renders the structured data

For highlighting:
```
Side Panel → Background → Content Script → highlighter.ts
```

## Known Limitations (Phase 1)

- **Element cap**: Maximum 1500 elements extracted per page (configurable in `src/shared/constants.ts`)
- **Noise filtering**: Elements smaller than 4px² area are skipped
- **Restricted pages**: Content scripts cannot run on `chrome://`, Chrome Web Store, PDF viewers, etc. — error state is shown instead
- **Demo site**: Must be served locally (not opened as `file://` in some cases)

## Security

- **Zero network calls**: Verified by grepping built output for `fetch(`, `XMLHttpRequest`, and hardcoded URLs
- **No innerHTML**: DOM extraction produces typed objects, never raw HTML
- **No eval**: All code is statically bundled
- **Non-destructive highlighting**: Overlays are injected as siblings, never mutate target elements
- **Sensitive value masking**: Password-type inputs display `••••••••` in the inspector

## Phase 2+ Extension Points

The following are documented in `src/shared/types.ts` but not implemented:

```ts
// privacyClassification?: unknown;
// sensitivity?: unknown;
// disclosureDecision?: unknown;
```

## Development

```bash
# Type check
npm run typecheck

# Build
npm run build

# Serve demo site
npm run demo
```

## License

Hackathon project — see LICENSE if present.
