# Privacy-Preserving Browser Agent
## Phase 2 Checkpoint

**Status:** PHASE 2 COMPLETE  
**Next:** PHASE 3 — TASK-AWARE MINIMUM DISCLOSURE

---

### 1. Project Objective

Build a Chrome extension that lets a cloud AI reason over a webpage and propose actions, without ever seeing raw sensitive data or gaining unrestricted control of the browser. Phase 1+2 deliver the local perception and privacy classification layers. Phase 3–5 (task filtering, cloud LLM, action gate) are future work.

### 2. Phase 1 Functionality

- Chrome Manifest V3 extension with React + TypeScript side panel
- Content script extracts structured `PageRepresentation` from any webpage on demand
- `PageElement` objects with id, tag, type, text, label, ariaLabel, visible, enabled, clickable, boundingBox
- Stable ID system via `data-ppba-id` attributes + WeakMap cache
- Element inspector with search, filter (all/input/button/link/visible/interactive)
- Non-destructive highlight overlay (fixed-position sibling div, not style mutation)
- Restricted-page error handling (`chrome://`, Web Store, etc.)
- Survives page reload without extension reload
- Zero network calls, zero backend, zero AI

### 3. Phase 2 Functionality

- Local privacy engine classifies every input-like `PageElement`
- Evidence extraction from live DOM: label resolution (6-priority §6), attribute scanning
- Hybrid classification: input type + autocomplete + label/name/id keywords + pattern matching
- Confidence scoring: weighted signal combination, deduplication, 0.40 classification floor
- 15 PII types, 4 sensitivity tiers (PUBLIC/CONTEXTUAL/PERSONAL/SECRET)
- `PrivacyAssessment` per element, `PrivacyAnalysis` page-level summary
- Privacy View in side panel with summary counts, sensitivity filter, expandable detail panels
- Sensitivity-coded highlight overlays (green/orange/red/purple)
- Luhn checksum for credit card validation
- False-positive corpus verified (price, airline, flight number → PUBLIC/NONE)

### 4. Current Project Architecture

```
Phase 1 Pipeline:
  Side Panel → ANALYZE_PAGE → Background → Content Script
  → domExtractor → PageRepresentation → Background → Side Panel

Phase 2 Pipeline (runs inside content script after extraction):
  PageRepresentation → piiDetector → for each input element:
    → evidenceExtractor (DOM read) → EvidenceSignal[]
    → scoreAndCombine (pure) → PrivacyAssessment
  → PrivacyAnalysis → Background → Side Panel
```

### 5. File Structure

```
src/
├── background/serviceWorker.ts        # Message router
├── content/
│   ├── contentScript.ts               # Entry point, runs detectPII after extraction
│   ├── domExtractor.ts                # Pure DOM extraction
│   ├── elementUtils.ts                # Visibility, clickability, ID assignment
│   └── highlighter.ts                 # Non-destructive overlay (sensitivity colors)
├── privacy/
│   ├── privacyTypes.ts                # PIIType, SensitivityLevel, EvidenceSignal, PrivacyAssessment
│   ├── sensitivity.ts                 # PIIType → SensitivityLevel table + colors
│   ├── confidence.ts                  # Scoring algorithm, Luhn, confidence bands
│   ├── evidenceExtractor.ts           # DOM → EvidenceSignal[] (label resolution)
│   ├── piiDetector.ts                 # Orchestrator: PageRepresentation → PrivacyAnalysis
│   ├── index.ts                       # Public API re-exports
│   ├── rules/
│   │   ├── inputTypeRules.ts          # Data table: input type → PII type
│   │   ├── autocompleteRules.ts       # Data table: autocomplete → PII type
│   │   ├── labelRules.ts              # Data table: keyword → PII type
│   │   ├── patternRules.ts            # Luhn, email regex, phone heuristic
│   │   └── contextRules.ts            # DOM context rules
│   └── classifiers/
│       ├── emailClassifier.ts
│       ├── phoneClassifier.ts
│       ├── cardClassifier.ts
│       ├── passwordClassifier.ts
│       ├── identityClassifier.ts
│       └── genericClassifier.ts
├── sidepanel/
│   ├── App.tsx                        # Main orchestrator (holds both state objects)
│   ├── index.tsx, index.html
│   ├── components/
│   │   ├── PageOverview.tsx
│   │   ├── ElementInspector.tsx
│   │   ├── AnalyzeButton.tsx
│   │   └── PrivacyView.tsx            # Privacy analysis UI
│   └── styles/panel.css
├── shared/
│   ├── types.ts                       # PageRepresentation, PageElement (Phase 1)
│   ├── messages.ts                    # Discriminated-union message contracts
│   └── constants.ts                   # PPBA_ID_ATTR, colors, limits
├── demo/flight-booking/               # Synthetic demo site
│   ├── index.html, styles.css, script.js
└── manifest.json
```

### 6. PII Categories

`NONE`, `PERSON_NAME`, `EMAIL`, `PHONE`, `ADDRESS`, `PASSWORD`, `CARD_NUMBER`, `CARD_EXPIRY`, `CVV`, `BANK_ACCOUNT`, `PASSPORT_NUMBER`, `NATIONAL_ID`, `TAX_ID`, `DATE_OF_BIRTH`, `LOCATION`

### 7. Sensitivity Levels

| Level | Color | Examples |
|-------|-------|----------|
| PUBLIC | Green `#4CAF50` | Price, airline, flight number |
| CONTEXTUAL | Orange `#FF9800` | Origin/destination, travel date |
| PERSONAL | Red `#F44336` | Name, email, phone, address, DOB |
| SECRET | Purple `#9C27B0` | Password, CVV, card number, passport |

### 8. Evidence Sources (§6 priority)

1. `<label for="{id}">` (explicit) — weight 0.25
2. Wrapping `<label>` (implicit) — weight 0.25
3. `aria-labelledby` resolved text — weight 0.25
4. `aria-label` attribute — weight 0.25
5. Nearby context (3 levels up, 2 siblings back) — weight 0.10
6. `placeholder` attribute — weight 0.10
7. `type` attribute — weight 0.50 (strong)
8. `autocomplete` attribute — weight 0.50 (strong)
9. `name` attribute keywords — weight 0.25
10. `id` attribute keywords — weight 0.25

### 9. Confidence Scoring

- **Strong (0.50):** exact input type, exact autocomplete, Luhn-valid card
- **Medium (0.25):** label/name/id keyword match
- **Weak (0.10):** placeholder, context, phone pattern
- **Floor:** 0.40 — below this → NONE/PUBLIC
- **Deduplication:** same method+value counted once per type
- **Bands:** ≥0.85 HIGH · 0.60–0.84 MEDIUM · 0.40–0.59 LOW · <0.40 UNCLASSIFIED

### 10. Privacy UI

- Tab bar: "Elements" (Phase 1) | "🔐 Privacy" (Phase 2)
- Summary: analyzed / public / contextual / personal / secret counts
- Sensitivity filter buttons (ALL / SECRET / PERSONAL / CONTEXTUAL / PUBLIC)
- Scrollable assessment list with color-coded left border
- Each entity shows: PII type, sensitivity badge, confidence %, band
- Expandable detail panel: explanation, detection methods (✓ checklist), evidence signals
- Click entity → highlights element on page with sensitivity-colored overlay
- No raw field values rendered anywhere in the UI

### 11. Security Guarantees

- Zero network calls (verified by grep)
- No `innerHTML` dumps or raw HTML serialization
- No `eval` or dynamic code execution
- No sensitive values in console.log (verified by grep)
- Evidence signals contain only static metadata (attribute names, label text)
- Highlight overlay is non-destructive (sibling div, not style mutation)
- Password fields display `••••••••` in element inspector

### 12. Test Results

```
Test Files  6 passed (6)
     Tests  126 passed (126)

Phase 1 tests (66):
  elementUtils.test.ts     38 tests ✓
  domExtractor.test.ts     18 tests ✓
  highlighter.test.ts      10 tests ✓

Phase 2 tests (60):
  confidence.test.ts       19 tests ✓
  evidenceExtractor.test.ts 30 tests ✓
  integration.test.ts      11 tests ✓
```

### 13. Build Result

```
npm run build → tsc --noEmit && vite build
✓ 48 modules transformed
✓ built in 659ms
Output: dist/ (manifest.json + 5 JS bundles + 1 CSS)
```

### 14. Demo Instructions

```bash
npm install                # Install dependencies
npm run build              # Build extension → dist/
npm run demo               # Serve demo at http://localhost:8080
```

Load `dist/` via `chrome://extensions` → Load unpacked.  
Open demo site → click 🛡️ → Analyze → switch to "Privacy" tab.

**Chrome 114+ required** (for `chrome.sidePanel` API).

### 15. Known Limitations

- **Element cap:** 1500 elements max per extraction (configurable in constants.ts)
- **Context traversal cap:** 3 levels up, 2 siblings back — may miss deeply nested labels
- **Phone pattern:** digit-count heuristic alone is weak (0.10) — needs corroboration
- **Passport detection:** keyword-only (no value-shape regex) per spec
- **CamelCase splitting:** handles `camelCase` but not `PascalCase` without separators
- **Bare "name" keyword:** too generic to match — requires multi-word phrases
- **CVV with type="password":** label "CVV" correctly wins over generic PASSWORD type

### 16. Current Restrictions

- Phase 1 types (`PageElement`, `PageRepresentation`) are frozen — extend additively only
- Phase 2 types (`PrivacyAssessment`, `PrivacyAnalysis`) are stored separately, joined by `elementId`
- No mutation of Phase 1's extraction output
- No redaction, masking, or DOM value alteration
- Rule tables are data, not code branches — keep them that way

### 17. What Must NOT Be Implemented Yet

- Sanitized payload generation
- Task relevance / minimum disclosure
- Cloud LLM / VLM communication
- Screenshot capture or sanitization
- OCR / vision models
- WebGPU / ONNX inference
- Action execution / form filling
- Backend server architecture
- Authentication / database
- Multi-agent orchestration

### 18. Exact Next-Phase Objective

**Phase 3 — Task-Aware Minimum Disclosure:**

Given a `PageRepresentation` + `PrivacyAnalysis` + a user task description, decide what subset of the sanitized representation the task actually needs. Produce a `SanitizedContext` that includes only task-relevant elements with appropriate sensitivity handling. Still zero network calls — this is the local filtering layer before anything reaches a cloud LLM.
