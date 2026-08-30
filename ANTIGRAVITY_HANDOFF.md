# ANTIGRAVITY_HANDOFF.md

## PROJECT
Privacy-Preserving Browser Vision Agent (PPBA)

## CURRENT VERSION
Phase 5 — Local Vision Context + Action Gate (COMPLETE)

## GIT BASELINE
`591262f` — "Phase 5 complete - vision privacy and action gate"

## CURRENT TESTS
235/235 passing (228 client + 7 server)

## ARCHITECTURE

```
Phase 1 — Local Page Perception
  Content script extracts structured PageRepresentation from DOM
  
Phase 2 — Local PII Detection
  Privacy engine classifies every input element (15 PII types, 4 sensitivity tiers)
  
Phase 3 — Task-Aware Minimum Disclosure
  Disclosure policy determines what the AI may see (ALLOW/MINIMIZE/EXCLUDE/BLOCK)
  
Phase 4 — Privacy Firewall + Server AI
  Only SanitizedContext crosses the network. Server returns structured action proposals.
  
Phase 5 — Local Visual Sanitization + Action Gate
  DOM-backed visual context with local redaction. Action Gate validates AI proposals.
  User must approve all actions before execution.
```

## IMPORTANT SECURITY BOUNDARY

**The browser/client is the privacy trust boundary.**

- The server receives ONLY sanitized/approved context (SanitizedContext)
- The server CANNOT directly execute browser actions
- Browser actions pass through the local Action Gate AND user approval
- Only CLICK, SCROLL, SELECT actions are allowed (no eval, no form submit, no arbitrary JS)
- SECRET/PASSWORD data is NEVER transmitted
- Raw screenshots NEVER leave the browser

## WHAT PHASE 5 ACTUALLY IMPLEMENTS

1. **Visual Context Builder** — DOM-backed visual regions with bounding boxes
2. **Visual Redactor** — Local redaction of sensitive regions (SECRET/PERSONAL elements)
3. **Action Gate** — 10-point security validation of AI-proposed actions
4. **Action Executor** — Controlled click/scroll execution in content script
5. **Approval UI** — Clear Approve/Reject interface for proposed actions
6. **Mock AI Provider v2** — Returns CLICK actions for flight selection

**NOT implemented (future work):**
- Real screenshot capture (chrome.tabs.captureVisibleTab)
- Canvas-based pixel redaction
- Vision Transformer / WebGPU / ONNX inference
- Real LLM provider (production would use OpenAI/Anthropic)

## HOW TO INSTALL

```bash
npm install
cd server && npm install
```

## HOW TO BUILD

```bash
npm run build
# Output: dist/ (Chrome extension files)
```

## HOW TO RUN TESTS

```bash
# Client tests (228 tests)
npm test

# Server tests (7 tests)
cd server && npm test
```

## HOW TO START THE SERVER

```bash
cd server && npm start
# Server runs on http://localhost:3001
# POST /reason — task reasoning endpoint
# GET /health — health check
```

## HOW TO LOAD THE CHROME EXTENSION

1. Build the extension: `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## HOW TO RUN THE DEMO

1. Start server: `cd server && npm start`
2. Serve demo site: `npm run demo` (serves at http://localhost:8080)
3. Load extension from `dist/`
4. Open http://localhost:8080 in Chrome
5. Click the extension icon (🛡️) to open the side panel
6. Click "Analyze" to extract page elements
7. Switch to "🎯 Task" tab
8. Enter: `Find the cheapest flight from Mumbai to Delhi`
9. Click "Analyze Task"
10. Click "Send to AI"
11. See the Action Gate approval UI
12. Click "✓ Approve" to execute the action

## EXPECTED END-TO-END FLOW

```
User: "Find the cheapest flight from Mumbai to Delhi"
  ↓
Phase 1: Extract 30+ page elements (flights, inputs, buttons)
  ↓
Phase 2: Classify PII (name=PERSONAL, card=SECRET, cvv=SECRET)
  ↓
Phase 3: FLIGHT_SEARCH intent → PRICE/AIRLINE/FLIGHT_NUMBER allowed
  ↓
Phase 4: SanitizedContext → Server → CLICK proposal for cheapest flight
  ↓
Phase 5: Action Gate validates → User approves → Content script clicks button
```

## IMPORTANT FILES

```
src/
├── action/                  # Phase 5 — Action Gate
│   ├── actionTypes.ts       # Action types (CLICK, SCROLL, SELECT)
│   ├── actionGate.ts        # 10-point security validation
│   └── actionGate.test.ts   # 14 security tests
├── vision/                  # Phase 5 — Visual Context
│   ├── visualTypes.ts       # Visual context types
│   ├── visualContextBuilder.ts  # DOM-backed visual context
│   └── visualContextBuilder.test.ts  # 15 tests
├── network/                 # Phase 4 — Network boundary
│   ├── networkTypes.ts      # Request/response types + zod schemas
│   ├── privacyFirewall.ts   # Builds request from SanitizedContext ONLY
│   └── responseValidator.ts # Validates AI response
├── task/                    # Phase 3 — Task-aware disclosure
│   ├── disclosurePolicy.ts  # Decision matrix (point-at-able during demo)
│   ├── sanitizedContextBuilder.ts  # Enforces no-raw-values invariant
│   └── taskAnalyzer.ts      # Deterministic task analysis
├── privacy/                 # Phase 2 — Privacy engine
│   ├── piiDetector.ts       # Orchestrator
│   └── evidenceExtractor.ts # DOM evidence extraction
├── content/                 # Phase 1 — DOM extraction
│   ├── domExtractor.ts      # Pure DOM extraction
│   └── elementUtils.ts      # Stable ID system
├── background/
│   └── serviceWorker.ts     # Message router + network + action execution
└── sidepanel/
    └── components/
        └── TaskView.tsx     # Task UI + Action Gate approval

server/
├── src/
│   ├── providers/mockAiProvider.ts  # Deterministic reasoning
│   └── routes/reason.ts            # POST /reason endpoint
└── package.json
```

## KNOWN LIMITATIONS

1. Mock provider is rule-based, not LLM-powered
2. Server runs on localhost only (no TLS, no auth)
3. Visual context uses DOM-backed regions, not actual screenshots
4. No real Vision Transformer / WebGPU / ONNX inference
5. Action vocabulary limited to CLICK, SCROLL, SELECT
6. Single-domain concept support (flight booking only)
7. Gazetteer coverage: ~80 cities
8. Transform functions: only TRAVEL_DATE and DEPARTURE_TIME/ARRIVAL_TIME

## DEBUGGING STARTING POINTS

- **Tests failing:** Run `npm test` and check which test file fails
- **Build failing:** Run `npm run build` and check TypeScript errors
- **Extension not working:** Check `chrome://extensions` for errors
- **Server not responding:** Check if `cd server && npm start` is running
- **Action Gate rejecting:** Check the browser console for Action Gate error codes
- **No elements found:** Ensure the demo site is loaded and you clicked "Analyze"

## BEFORE MAKING ANY CHANGES

**READ THESE FILES FIRST:**
1. `PROJECT_CONTEXT.md` — Master project context
2. `AGENTS.md` — Rules and constraints
3. `PHASE_5_CHECKPOINT.md` — Phase 5 complete documentation
4. `PHASE_5_FINAL_REPORT.md` — Phase 5 final report

**DO NOT:**
- Break the 235/235 test baseline
- Remove existing tests
- Rewrite working code unnecessarily
- Merge Phase 2 data into Phase 1 types
- Merge Phase 3 data into Phase 1/2 types
- Send raw screenshots over the network
- Allow arbitrary JavaScript execution
- Skip the Action Gate for any browser action
