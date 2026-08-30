# PROJECT_CONTEXT.md

**Project:** Privacy-Preserving Browser Agent (PPBA)
**Current Phase:** Phase 5 — Local Vision Context + Action Gate (COMPLETE)
**Next Phase:** Future work (see Phase 5 Final Report)
**Test Baseline:** 235/235 passing (228 client + 7 server)
**Build:** PASS (156 modules, ~1.1s)
**Network:** ONE fetch call (in `src/background/networkClient.ts` only)
**Server:** Express on `http://localhost:3001`

---

## 1. Project Objective

Build a Chrome extension that lets a cloud AI reason over a webpage and propose actions, without ever seeing raw sensitive data or gaining unrestricted control of the browser. Phase 1–5 deliver the complete pipeline: local perception, privacy classification, task-aware filtering, cloud AI integration, visual context, and action gate with user approval.

---

## 2. Current Architecture

```
Phase 1–3 Pipeline:
  Side Panel → ANALYZE_PAGE → Background → Content Script
  → domExtractor → PageRepresentation → piiDetector → PrivacyAnalysis
  → Side Panel → TaskView → SanitizedContext

Phase 4 Pipeline (NEW):
  TaskView → SEND_TO_AI message → Background Service Worker
    → networkClient.sendTaskReasoningRequest()
      → privacyFirewall.buildNetworkRequest(sanitizedContext, taskAnalysis)
        // ↑ ONLY accepts SanitizedContext
      → fetch('http://localhost:3001/reason')
        // ↑ ONLY fetch call in the extension
    → responseValidator.validateResponse()
    → AI_RESPONSE message → TaskView → ApprovedProposal display
```

---

## 3. Phase 1 — Element Extraction (FROZEN)

See `PHASE_2_CHECKPOINT.md`.

---

## 4. Phase 2 — Local Privacy Engine (FROZEN)

See `PHASE_2_CHECKPOINT.md`.

---

## 5. Phase 3 — Task-Aware Minimum Disclosure (FROZEN)

See `PHASE_3_CHECKPOINT.md`.

---

## 6. Phase 4 — Cloud LLM Integration (COMPLETE)

- **Privacy Firewall** builds `TaskReasoningRequest` ONLY from `SanitizedContext`
- **Network Client** — single fetch boundary
- **Response Validator** — validates AI response → `ApprovedProposal`
- **Mock AI Provider** — deterministic rule-based reasoning (returns CLICK actions)
- **Server** — minimal Express HTTP server
- **Zod schemas** — runtime validation on both client and server
- **Task tab UI** — "Send to AI" button + AI result display

## 7. Phase 5 — Local Vision Context + Action Gate (COMPLETE)

- **Visual Context Builder** — constructs DOM-backed visual context from page elements
- **Visual Redactor** — local redaction of sensitive visual regions before transmission
- **Action Gate** — validates AI-proposed actions against security rules
- **Action Executor** — controlled local execution with user approval
- **Approval UI** — clear Approve/Reject interface for proposed actions
- **Content Script Execution** — safe click/scroll execution in content script context
- **Mock AI Provider v2** — returns CLICK actions for flight selection
- **New action types** — CLICK, SCROLL added to ProposedActionType vocabulary

---

## 8. File Structure

```
src/
├── action/                            # Phase 5 — Action Gate
│   ├── actionTypes.ts                 # Action types + vocabulary
│   ├── actionTypes.ts.test            # (tested via actionGate tests)
│   ├── actionGate.ts                  # Validates AI-proposed actions
│   ├── actionGate.test.ts             # 14 tests
│   └── index.ts                       # Public API
├── vision/                            # Phase 5 — Visual Context
│   ├── visualTypes.ts                 # Visual context types
│   ├── visualContextBuilder.ts        # Builds visual context from DOM
│   ├── visualContextBuilder.test.ts   # 15 tests
│   ├── visualRedactor.ts             # Local visual redaction
│   └── index.ts                       # Public API
├── network/
│   ├── networkTypes.ts               # Request/response types + zod schemas
│   ├── privacyFirewall.ts            # Builds request from SanitizedContext ONLY
│   ├── privacyFirewall.test.ts       # 8 tests
│   ├── responseValidator.ts          # Validates AI response → ApprovedProposal
│   └── responseValidator.test.ts     # 8 tests
├── background/
│   ├── serviceWorker.ts              # Message router + network + action execution
│   └── networkClient.ts             # Single fetch boundary
├── task/                             # Phase 3 (unchanged)
├── privacy/                          # Phase 2 (unchanged)
├── content/                          # Phase 1 + action execution
│   ├── contentScript.ts              # Updated: EXECUTE_ACTION handler
│   └── ...                           # Other files unchanged
├── sidepanel/
│   └── components/
│       ├── TaskView.tsx              # Updated: Action gate + approval UI
│       └── ...                       # Other components unchanged
├── shared/
│   ├── messages.ts                   # Added: EXECUTE_ACTION, ACTION_RESULT
│   └── ...                           # Other files unchanged
└── manifest.json

server/
├── src/
│   ├── index.ts                      # Express server
│   ├── routes/reason.ts              # POST /reason
│   ├── providers/
│   │   ├── aiProvider.ts             # Interface
│   │   ├── mockAiProvider.ts         # Deterministic reasoning (returns CLICK)
│   │   └── index.ts                  # Selection
│   ├── schemas/
│   │   ├── request.ts                # Zod schema
│   │   └── response.ts              # Zod schema (added CLICK, SCROLL)
│   └── __tests__/reason.test.ts      # 7 tests
├── package.json
└── tsconfig.json
```

---

## 8. Network Boundary

**Single fetch:** `src/background/networkClient.ts` (line 43)
**Server:** `http://localhost:3001`
**Manifest:** `host_permissions: ["http://localhost:3001/*"]`

---

## 9. Security Guarantees

| Guarantee | Enforcement |
|-----------|-------------|
| Only SanitizedContext crosses network | TypeScript signature |
| No EXCLUDE/BLOCK leaks | Defense-in-depth re-filter |
| No spread operators | Explicit field mapping |
| No unexpected fields | Zod `.strict()` |
| requestId matches | Validator check |
| No undisclosed elements | Validator check |
| No automatic execution | Action Gate requires approval |
| No eval/dynamic code | grep verified |
| AI strings as plain text | React JSX default |
| Only CLICK/SCROLL/SELECT actions allowed | Action Gate vocabulary check |
| Sensitive elements cannot be acted upon | Action Gate BLOCK check |
| Visual regions redacted locally | Visual Redactor |
| Raw screenshots never leave browser | No capture mechanism implemented |
| User must approve all actions | Action Gate + UI approval flow |

---

## 11. Test Baseline

```
Client tests (13 files, 228 tests):
  Phase 1: 66 tests
  Phase 2: 60 tests
  Phase 3: 57 tests
  Phase 4: 16 tests (firewall + validator)
  Phase 5: 29 tests (14 action gate + 15 visual context)

Server tests (1 file, 7 tests):
  Phase 4: 7 tests

Total: 235/235 passing
```

---

## 12. Build Output

```
npm run build → tsc --noEmit && vite build
✓ 156 modules transformed
✓ built in ~1.1s
```

---

## 13. Known Limitations

- Mock provider is rule-based, not LLM-powered
- Server runs on localhost only (no TLS, no auth)
- Gazetteer coverage: ~80 cities
- Transform functions: only TRAVEL_DATE and DEPARTURE_TIME/ARRIVAL_TIME
- SECRET data always blocked (no user-override path)
- Visual context uses DOM-backed regions, not actual screenshots
- No real Vision Transformer / WebGPU / ONNX inference
- Action vocabulary limited to CLICK, SCROLL, SELECT

---

## 14. What Is NOT Implemented (Future Work)

- Real screenshot capture (chrome.tabs.captureVisibleTab)
- Canvas-based pixel redaction
- OCR / vision models (WebGPU / ONNX)
- Real LLM provider (production would use OpenAI/Anthropic)
- TLS / authentication for server
- Production deployment
- Multi-agent orchestration
- Arbitrary form filling
- Multi-domain concept support

---

## 15. Phase 5 Objective (COMPLETE)

**Phase 5 — Local Vision Context + Action Gate:**

Given an `ApprovedProposal` (Phase 4 output), validate the proposed actions through the local Action Gate, present them to the user for approval, and execute them in the content script context. Introduces DOM interaction for the first time, with strict security controls.

---

## 16. Key Constraints

1. Preserve Phase 1–3 functionality.
2. Preserve Phase 4 functionality.
3. Preserve Phase 5 functionality.
4. Do not unnecessarily rewrite working code.
5. Do not remove existing tests.
6. Never log raw sensitive values.
7. Never transmit sensitive data without explicit implementation approval.
8. Do not introduce network calls unless explicitly instructed.
9. Make incremental changes.
10. Preserve the existing architecture unless there is a concrete technical reason to change it.
11. Phase 1 types are frozen — extend additively only.
12. Phase 2 types are stored separately, joined by elementId.
13. Phase 3 types are the third state layer, joined by elementId.
14. Rule tables are data, not code branches.
15. `evidenceExtractor.ts` touches the DOM; everything downstream is pure functions.
16. **Phase 3 security invariant:** Raw user-entered or identity-bearing data NEVER enters SanitizedContext.
17. **Phase 4 security invariant:** Only SanitizedContext crosses the network boundary. Single fetch file. No automatic action execution.
18. **Phase 5 security invariant:** Only CLICK/SCROLL/SELECT actions allowed. User must approve all actions. Sensitive elements cannot be acted upon.
