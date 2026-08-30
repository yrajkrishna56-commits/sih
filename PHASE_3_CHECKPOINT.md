# Privacy-Preserving Browser Agent
## Phase 3 Checkpoint

**Status:** PHASE 3 COMPLETE
**Next:** PHASE 4 — CLOUD LLM INTEGRATION

---

### 1. Project Objective

Build a Chrome extension that lets a cloud AI reason over a webpage and propose actions, without ever seeing raw sensitive data or gaining unrestricted control of the browser. Phase 1–3 deliver the local perception, privacy classification, and task-aware filtering layers. Phase 4–5 (cloud LLM, action gate) are future work.

### 2. Phase 1 Functionality (FROZEN)

- Chrome Manifest V3 extension with React + TypeScript side panel
- Content script extracts structured `PageRepresentation` from any webpage on demand
- `PageElement` objects with id, tag, type, text, label, ariaLabel, visible, enabled, clickable, boundingBox
- Stable ID system via `data-ppba-id` attributes + WeakMap cache
- Element inspector with search, filter (all/input/button/link/visible/interactive)
- Non-destructive highlight overlay (fixed-position sibling div, not style mutation)
- Restricted-page error handling (`chrome://`, Web Store, etc.)
- Survives page reload without extension reload
- Zero network calls, zero backend, zero AI

### 3. Phase 2 Functionality (FROZEN)

- Local privacy engine classifies every input-like `PageElement`
- Evidence extraction from live DOM: label resolution (6-priority), attribute scanning
- Hybrid classification: input type + autocomplete + label/name/id keywords + pattern matching
- Confidence scoring: weighted signal combination, deduplication, 0.40 classification floor
- 15 PII types, 4 sensitivity tiers (PUBLIC/CONTEXTUAL/PERSONAL/SECRET)
- `PrivacyAssessment` per element, `PrivacyAnalysis` page-level summary
- Privacy View in side panel with summary counts, sensitivity filter, expandable detail panels
- Sensitivity-coded highlight overlays (green/orange/red/purple)
- Luhn checksum for credit card validation
- False-positive corpus verified (price, airline, flight number → PUBLIC/NONE)

### 4. Phase 3 Functionality

- **Concept tagger** maps every `PageElement` to a `DomainConcept` using keyword rules (same pattern as Phase 2's classifiers)
- **Task analyzer** takes user task text and produces `TaskAnalysisResult` with intent detection, entity extraction (gazetteer-based), and required concepts mapping
- **Disclosure Policy Engine** applies a 6-rule decision matrix:
  1. UNKNOWN task → conservative EXCLUDE (except PUBLIC static content)
  2. Concept not in requiredConcepts → EXCLUDE
  3. Concept required + SECRET → BLOCK (unconditional)
  4. Concept required + PERSONAL → MINIMIZE (or TRANSFORM if transform exists)
  5. Concept required + CONTEXTUAL → ALLOW (or TRANSFORM if transform exists)
  6. Concept required + PUBLIC → ALLOW
- **SanitizedContext builder** enforces security invariant: raw user-entered or identity-bearing data NEVER enters `SanitizedContext`
- **Transform functions** implemented for: `TRAVEL_DATE` (month-level granularity), `DEPARTURE_TIME`/`ARRIVAL_TIME` (rounded to hour)
- **Task tab** in side panel shows: intent + confidence, required/excluded/blocked/minimized concepts, disclosure summary counts
- 57 new tests (19 conceptTagger + 21 taskAnalyzer + 17 disclosurePolicy)
- Security structural test: asserts no raw input values appear in `SanitizedContext`

### 5. Current Architecture

```
Phase 1 Pipeline:
  Side Panel → ANALYZE_PAGE → Background → Content Script
  → domExtractor → PageRepresentation → Background → Side Panel

Phase 2 Pipeline (runs inside content script after extraction):
  PageRepresentation → piiDetector → for each input element:
    → evidenceExtractor (DOM read) → EvidenceSignal[]
    → scoreAndCombine (pure) → PrivacyAssessment
  → PrivacyAnalysis → Background → Side Panel

Phase 3 Pipeline (runs in side panel, no DOM access):
  User Task Text → analyzeTask() → TaskAnalysisResult
  PageRepresentation + PrivacyAnalysis + TaskAnalysisResult
    → tagAllElements() → conceptMap (elementId → DomainConcept)
    → buildTaggedElement() → TaggedElement[]
    → evaluateDisclosurePlan() → DisclosurePlan
    → buildSanitizedContext() → SanitizedContext
```

### 6. File Structure

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
├── task/
│   ├── taskTypes.ts                   # TaskIntent, DomainConcept, DisclosurePlan, SanitizedContext
│   ├── taskAnalyzer.ts                # Task text → TaskAnalysisResult (deterministic)
│   ├── intentRules.ts                 # Data table: intent → keywords + required concepts
│   ├── entityExtractor.ts             # Gazetteer + from/to pattern matching
│   ├── conceptTagger.ts               # PageElement → DomainConcept mapping
│   ├── conceptRules.ts                # Data table: element text → DomainConcept
│   ├── disclosurePolicy.ts            # Decision matrix: (task, concept, sensitivity) → ruling
│   ├── sanitizedContextBuilder.ts     # Builds SanitizedContext (enforces no-raw-values)
│   └── index.ts                       # Public API re-exports
├── sidepanel/
│   ├── App.tsx                        # Main orchestrator (holds all three state layers)
│   ├── index.tsx, index.html
│   ├── components/
│   │   ├── PageOverview.tsx
│   │   ├── ElementInspector.tsx
│   │   ├── AnalyzeButton.tsx
│   │   ├── PrivacyView.tsx            # Privacy analysis UI (Phase 2)
│   │   └── TaskView.tsx               # Task analysis UI (Phase 3)
│   └── styles/panel.css
├── shared/
│   ├── types.ts                       # PageRepresentation, PageElement (Phase 1, FROZEN)
│   ├── messages.ts                    # Discriminated-union message contracts
│   └── constants.ts                   # PPBA_ID_ATTR, colors, limits, disclosure colors
├── demo/flight-booking/
│   ├── index.html, styles.css, script.js
└── manifest.json
```

### 7. PII Categories

`NONE`, `PERSON_NAME`, `EMAIL`, `PHONE`, `ADDRESS`, `PASSWORD`, `CARD_NUMBER`, `CARD_EXPIRY`, `CVV`, `BANK_ACCOUNT`, `PASSPORT_NUMBER`, `NATIONAL_ID`, `TAX_ID`, `DATE_OF_BIRTH`, `LOCATION`

### 8. Sensitivity Levels

| Level | Color | Examples |
|-------|-------|----------|
| PUBLIC | Green `#4CAF50` | Price, airline, flight number |
| CONTEXTUAL | Orange `#FF9800` | Origin/destination, travel date |
| PERSONAL | Red `#F44336` | Name, email, phone, address, DOB |
| SECRET | Purple `#9C27B0` | Password, CVV, card number, passport |

### 9. Domain Concepts

| Concept | Description | Sensitivity |
|---------|-------------|-------------|
| PRICE | Flight fare/price | PUBLIC |
| FLIGHT_NUMBER | Flight code (SB 101) | PUBLIC |
| AIRLINE | Airline name | PUBLIC |
| DEPARTURE_TIME | Departure time | PUBLIC |
| ARRIVAL_TIME | Arrival time | PUBLIC |
| DURATION | Flight duration | PUBLIC |
| ORIGIN | Departure city | CONTEXTUAL |
| DESTINATION | Arrival city | CONTEXTUAL |
| TRAVEL_DATE | Travel date | CONTEXTUAL |
| SELECTION_CONTROL | "Select Flight" buttons | PUBLIC |
| SEARCH_CONTROL | "Search Flights" button | PUBLIC |
| PASSENGER_NAME | Passenger full name | PERSONAL |
| PASSENGER_EMAIL | Passenger email | PERSONAL |
| PASSENGER_PHONE | Passenger phone | PERSONAL |
| PASSPORT | Passport number | SECRET |
| PAYMENT_CARD | Credit/debit card number | SECRET |
| PAYMENT_CVV | Card CVV/CVC | SECRET |
| PAYMENT_EXPIRY | Card expiry date | SECRET |

### 10. Task Intents

| Intent | Required Concepts |
|--------|-------------------|
| FLIGHT_SEARCH | ORIGIN, DESTINATION, PRICE, AIRLINE, DEPARTURE_TIME, ARRIVAL_TIME, DURATION, FLIGHT_NUMBER, SEARCH_CONTROL, SELECTION_CONTROL |
| FLIGHT_SELECTION | FLIGHT_NUMBER, AIRLINE, PRICE, DEPARTURE_TIME, ARRIVAL_TIME, SELECTION_CONTROL |
| FORM_REVIEW | PASSENGER_NAME, PASSENGER_EMAIL, PASSENGER_PHONE, PASSPORT, PAYMENT_CARD, PAYMENT_EXPIRY, PAYMENT_CVV, ORIGIN, DESTINATION, TRAVEL_DATE |
| FORM_COMPLETION_PREVIEW | PASSENGER_NAME, PASSENGER_EMAIL, PASSENGER_PHONE, PASSPORT, PAYMENT_CARD, PAYMENT_EXPIRY, PAYMENT_CVV, ORIGIN, DESTINATION, TRAVEL_DATE |
| GENERIC_PAGE_NAVIGATION | SEARCH_CONTROL, SELECTION_CONTROL |
| UNKNOWN | (none — conservative exclude) |

### 11. Evidence Sources (Phase 2, priority order)

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

### 12. Confidence Scoring (Phase 2)

- **Strong (0.50):** exact input type, exact autocomplete, Luhn-valid card
- **Medium (0.25):** label/name/id keyword match
- **Weak (0.10):** placeholder, context, phone pattern
- **Floor:** 0.40 — below this → NONE/PUBLIC
- **Deduplication:** same method+value counted once per type
- **Bands:** ≥0.85 HIGH · 0.60–0.84 MEDIUM · 0.40–0.59 LOW · <0.40 UNCLASSIFIED

### 13. Privacy UI

- Tab bar: "Elements" (Phase 1) | "🔐 Privacy" (Phase 2) | "🎯 Task" (Phase 3)
- Privacy summary: analyzed / public / contextual / personal / secret counts
- Sensitivity filter buttons (ALL / SECRET / PERSONAL / CONTEXTUAL / PUBLIC)
- Scrollable assessment list with color-coded left border
- Each entity shows: PII type, sensitivity badge, confidence %, band
- Expandable detail panel: explanation, detection methods (✓ checklist), evidence signals
- Click entity → highlights element on page with sensitivity-colored overlay
- No raw field values rendered anywhere in the UI

### 14. Task UI

- Task text input + "Analyze Task" button
- Detected intent + confidence band
- Entities: origin / destination (from gazetteer extraction)
- Required concepts (✓ list with elements that satisfy them)
- Excluded concepts (× list, NOT_TASK_RELEVANT)
- Blocked concepts (🔒 list, SECRET_ALWAYS_BLOCKED)
- Minimized/Transformed concepts if any
- Disclosure summary counts (allowed / minimized / excluded / blocked)
- Click element → highlights on page with disclosure color

### 15. Security Guarantees

- Zero network calls (verified by grep)
- No `innerHTML` dumps or raw HTML serialization
- No `eval` or dynamic code execution
- No sensitive values in console.log (verified by grep)
- Evidence signals contain only static page metadata (attribute names, label text)
- Highlight overlay is non-destructive (sibling div, not style mutation)
- Password fields display `••••••••` in element inspector
- All data stays within extension messaging boundary
- **Phase 3:** Raw user-entered or identity-bearing data NEVER enters `SanitizedContext` (structural test verifies)

### 16. Test Results

```
Test Files  9 passed (9)
     Tests  183 passed (183)

Phase 1 tests (66):
  elementUtils.test.ts     38 tests
  domExtractor.test.ts     18 tests
  highlighter.test.ts      10 tests

Phase 2 tests (60):
  confidence.test.ts       19 tests
  evidenceExtractor.test.ts 30 tests
  integration.test.ts      11 tests

Phase 3 tests (57):
  taskAnalyzer.test.ts     21 tests
  conceptTagger.test.ts    19 tests
  disclosurePolicy.test.ts 17 tests
```

### 17. Build Result

```
npm run build → tsc --noEmit && vite build
✓ 56 modules transformed
✓ built in ~946ms
Output: dist/ (manifest.json + JS bundles + CSS)
```

### 18. Demo Instructions

```bash
npm install                # Install dependencies
npm run build              # Build extension → dist/
npm run demo               # Serve demo at http://localhost:8080
```

Load `dist/` via `chrome://extensions` → Load unpacked.
Open demo site → click 🛡️ → Analyze → switch to "🎯 Task" tab.

**Demo walkthrough:**
1. Enter: "Find the cheapest flight from Mumbai to Delhi"
2. Click "Analyze Task"
3. See: FLIGHT_SEARCH intent, origin/destination extracted, PRICE/AIRLINE/FLIGHT_NUMBER allowed, PASSENGER_NAME/PAYMENT_CARD excluded/blocked

**UNKNOWN edge case:**
1. Enter: "what's the weather like"
2. Click "Analyze Task"
3. See: UNKNOWN intent → everything except PUBLIC static → EXCLUDE

**Chrome 114+ required** (for `chrome.sidePanel` API).

### 19. Known Limitations

- **Element cap:** 1500 elements max per extraction (configurable in constants.ts)
- **Context traversal cap:** 3 levels up, 2 siblings back — may miss deeply nested labels
- **Phone pattern:** digit-count heuristic alone is weak (0.10) — needs corroboration
- **Passport detection:** keyword-only, no value-shape regex
- **CamelCase splitting:** handles `camelCase` but not `PascalCase` without separators
- **Bare "name" keyword:** too generic to match — requires multi-word phrases
- **Gazetteer coverage:** small seed list (~80 cities) — not a claim of full geographic coverage
- **Concept tagger:** flight-booking-specific vocabulary — needs extension for other domains
- **Transform functions:** only TRAVEL_DATE (month-level) and DEPARTURE_TIME/ARRIVAL_TIME (hour-rounding) implemented; all others fall back to MINIMIZE
- **SECRET override:** blocked unconditionally in Phase 3; a future Action Gate phase could add user-approved override

### 20. Current Restrictions

- Phase 1 types (`PageElement`, `PageRepresentation`) are frozen — extend additively only
- Phase 2 types (`PrivacyAssessment`, `PrivacyAnalysis`) are stored separately, joined by `elementId`
- Phase 3 types (`TaskAnalysisResult`, `DisclosurePlan`, `SanitizedContext`) are the third state layer, joined by `elementId`
- No mutation of Phase 1's extraction output
- No redaction, masking, or DOM value alteration
- Rule tables are data, not code branches — keep them that way
- **Phase 3 security invariant:** Raw user-entered or identity-bearing data NEVER enters `SanitizedContext`

### 21. What Must NOT Be Implemented Yet

- Cloud LLM / VLM communication
- Screenshot capture or sanitization
- OCR / vision models
- WebGPU / ONNX inference
- Action execution / form filling
- Backend server architecture
- Authentication / database
- Multi-agent orchestration

### 22. Exact Next-Phase Objective

**Phase 4 — Cloud LLM Integration:**

Given a `SanitizedContext` (Phase 3 output), send it to a cloud LLM/VLM for reasoning and action proposal. This phase introduces network calls for the first time — all data passes through the SanitizedContext filter before reaching the cloud.

### 23. Git Checkpoint

```
Commit: 6ab1629
Message: Phase 3 complete: Task-Aware Minimum Disclosure
Branch: master
Working tree: CLEAN
```
