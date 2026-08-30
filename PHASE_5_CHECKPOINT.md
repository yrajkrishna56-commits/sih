# Privacy-Preserving Browser Agent
## Phase 5 Checkpoint

**Status:** PHASE 5 COMPLETE
**Next:** Future work (see Phase 5 Final Report)

---

### 1. Project Objective

Build a Chrome extension that lets a cloud AI reason over a webpage and propose actions, without ever seeing raw sensitive data or gaining unrestricted control of the browser. Phase 1–5 deliver the complete pipeline: local perception, privacy classification, task-aware filtering, cloud AI integration, visual context, and action gate with user approval.

### 2. Phase 1–4 Functionality (FROZEN)

See `PHASE_4_CHECKPOINT.md` for complete Phase 1–4 documentation.

### 3. Phase 5 Functionality

- **Visual Context Builder** (`src/vision/visualContextBuilder.ts`) — constructs DOM-backed visual context from page elements. Uses element bounding boxes from Phase 1 as spatial information. Sanitized visual context includes only approved regions.

- **Visual Redactor** (`src/vision/visualRedactor.ts`) — classifies which elements must be visually redacted based on Phase 2 sensitivity and Phase 3 disclosure decisions. SECRET and PERSONAL elements are always redacted.

- **Action Gate** (`src/action/actionGate.ts`) — validates AI-proposed actions against 10 security checks:
  1. Action type is in allowed vocabulary (CLICK, SCROLL, SELECT)
  2. Element exists on the page
  3. Element was disclosed to the AI
  4. Element is in the current sanitized context
  5. Element is clickable (for CLICK actions)
  6. Element is not BLOCK-decision (SECRET defense-in-depth)
  7. Action type is not forbidden (eval, form submit, etc.)
  8. User approval is required for all consequential actions
  9. Rejected actions are never executed
  10. Action descriptions are human-readable

- **Content Script Executor** (`src/content/contentScript.ts`) — handles EXECUTE_ACTION messages. Executes only CLICK, SCROLL, and SELECT actions. Uses `element.click()` and `element.scrollIntoView()` — never eval(), innerHTML, or dynamic code.

- **Approval UI** (`src/sidepanel/components/TaskView.tsx`) — clear Approve/Reject interface for proposed actions. Shows action description, target element, and action type. Buttons are visually distinct (green/red).

- **Mock AI Provider v2** (`server/src/providers/mockAiProvider.ts`) — now returns CLICK actions for flight selection. Identifies cheapest flight and proposes clicking the corresponding select button.

- **Extended Action Vocabulary** — `CLICK` and `SCROLL` added to `ProposedActionType` in `networkTypes.ts` and server schemas.

### 4. Architecture

```
Phase 1–3 Pipeline (unchanged):
  Side Panel → ANALYZE_PAGE → Background → Content Script
  → domExtractor → PageRepresentation → piiDetector → PrivacyAnalysis
  → Side Panel → TaskView → SanitizedContext

Phase 4 Pipeline (unchanged):
  TaskView → SEND_TO_AI message → Background Service Worker
    → networkClient.sendTaskReasoningRequest()
      → privacyFirewall.buildNetworkRequest(sanitizedContext, taskAnalysis)
      → fetch('http://localhost:3001/reason')
    → responseValidator.validateResponse()
    → AI_RESPONSE message → TaskView → ApprovedProposal display

Phase 5 Pipeline (NEW):
  TaskView → AI_RESPONSE → Action Gate
    → validateAction(proposal, pageRep, disclosedIds, context)
      // 10 security checks
    → Action Pending UI → User clicks Approve
    → EXECUTE_ACTION message → Background → Content Script
      → element.click() / element.scrollIntoView()
    → ACTION_RESULT message → TaskView → Result display
```

### 5. File Structure

```
src/
├── action/                            # Phase 5 — Action Gate
│   ├── actionTypes.ts                 # Action types + vocabulary
│   ├── actionGate.ts                  # Validates AI-proposed actions
│   ├── actionGate.test.ts             # 14 tests
│   └── index.ts                       # Public API
├── vision/                            # Phase 5 — Visual Context
│   ├── visualTypes.ts                 # Visual context types
│   ├── visualContextBuilder.ts        # Builds visual context from DOM
│   ├── visualContextBuilder.test.ts   # 15 tests
│   ├── visualRedactor.ts             # Local visual redaction
│   └── index.ts                       # Public API
├── network/                           # Phase 4 (updated: CLICK/SCROLL types)
├── background/                        # Phase 4 (updated: EXECUTE_ACTION handling)
├── task/                              # Phase 3 (unchanged)
├── privacy/                           # Phase 2 (unchanged)
├── content/                           # Phase 1 (updated: EXECUTE_ACTION handler)
├── sidepanel/                         # Phase 3/4 (updated: Action Gate UI)
├── shared/                            # Phase 1 (updated: new message types)
└── manifest.json

server/
├── src/
│   ├── providers/mockAiProvider.ts    # Updated: returns CLICK actions
│   └── schemas/response.ts           # Updated: CLICK/SCROLL in enum
└── ...
```

### 6. Test Results

```
Client tests (13 files, 228 tests):
  Phase 1 tests (66): 66 passed
  Phase 2 tests (60): 60 passed
  Phase 3 tests (57): 57 passed
  Phase 4 tests (16): 16 passed
  Phase 5 tests (29): 29 passed
    actionGate.test.ts             14 tests
    visualContextBuilder.test.ts   15 tests

Server tests (1 file, 7 tests):
  reason.test.ts             7 passed

Total: 235 tests passing
```

### 7. Build Result

```
npm run build → tsc --noEmit && vite build
✓ 156 modules transformed
✓ built in ~1.1s
Output: dist/ (manifest.json + JS bundles + CSS)
```

### 8. Security Verification

#### Action Gate Tests (14 tests)
| Test | Result |
|------|--------|
| Valid CLICK accepted | ✅ PASS |
| Valid SCROLL accepted | ✅ PASS |
| Unknown action rejected | ✅ PASS |
| Unknown element rejected | ✅ PASS |
| Undisclosed element rejected | ✅ PASS |
| Stale element rejected | ✅ PASS |
| Sensitive element rejected | ✅ PASS |
| Arbitrary JavaScript rejected | ✅ PASS |
| Approval required | ✅ PASS |
| Rejected action never executed | ✅ PASS |
| Multiple actions — all must pass | ✅ PASS |
| No proposed actions handled | ✅ PASS |
| Non-clickable element rejected | ✅ PASS |
| Description is human-readable | ✅ PASS |

#### Visual Context Tests (15 tests)
| Test | Result |
|------|--------|
| Schema validation | ✅ PASS |
| Preserves page dimensions | ✅ PASS |
| Region has required fields | ✅ PASS |
| Sensitive bounding boxes redacted | ✅ PASS |
| BLOCK regions redacted | ✅ PASS |
| EXCLUDE regions redacted | ✅ PASS |
| Approved public regions available | ✅ PASS |
| No raw input values | ✅ PASS |
| No raw HTML | ✅ PASS |
| No screenshot before redaction | ✅ PASS |
| Empty visual context handled | ✅ PASS |
| Empty sanitized context handled | ✅ PASS |
| Summary counts accurate | ✅ PASS |
| Redaction summary readable | ✅ PASS |
| Redacted count matches | ✅ PASS |

#### Invariant Verification
| Invariant | Status |
|-----------|--------|
| Raw runtime input values never leave browser | ✅ PASS |
| SECRET data never transmitted | ✅ PASS |
| EXCLUDE/BLOCK never in network payload | ✅ PASS |
| Raw screenshots never leave browser | ✅ PASS (no capture implemented) |
| Only sanitized visual context transmitted | ✅ PASS |
| Server cannot directly execute browser actions | ✅ PASS |
| AI cannot reference undisclosed elements | ✅ PASS |
| AI cannot execute arbitrary JavaScript | ✅ PASS |
| Consequential actions require local approval | ✅ PASS |
| Phase 1–4 privacy guarantees intact | ✅ PASS (199 baseline tests) |

### 9. Demo Instructions

```bash
# Terminal 1: Start server
cd server && npm start

# Terminal 2: Build extension
npm run build

# Terminal 3: Serve demo site
npm run demo
```

1. Load `dist/` via `chrome://extensions` → Load unpacked
2. Open `http://localhost:8080` (flight booking demo)
3. Click 🛡️ → Analyze → switch to "🎯 Task" tab
4. Enter: "Find the cheapest flight from Mumbai to Delhi"
5. Click "Analyze Task" — see disclosure decisions
6. Click "Send to AI" — see mock AI result with proposed CLICK action
7. See: "Action Gate — Approval Required" UI
8. Click "✓ Approve" — action executes on the page
9. See: "Action Completed" result

### 10. Git Checkpoint

```
Commit: (pending)
Branch: master
Working tree: CLEAN (after commit)
```
