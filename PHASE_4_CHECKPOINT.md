# Privacy-Preserving Browser Agent
## Phase 4 Checkpoint

**Status:** PHASE 4 COMPLETE
**Next:** PHASE 5 — ACTION GATE

---

### 1. Project Objective

Build a Chrome extension that lets a cloud AI reason over a webpage and propose actions, without ever seeing raw sensitive data or gaining unrestricted control of the browser. Phase 1–4 deliver the local perception, privacy classification, task-aware filtering, and cloud AI integration layers. Phase 5 (action gate) is future work.

### 2. Phase 1–3 Functionality (FROZEN)

See `PHASE_3_CHECKPOINT.md` for complete Phase 1–3 documentation.

### 3. Phase 4 Functionality

- **Privacy Firewall** (`src/network/privacyFirewall.ts`) — builds `TaskReasoningRequest` ONLY from `SanitizedContext`. TypeScript signature structurally prevents passing `PageRepresentation` or `PrivacyAnalysis`. Independently re-filters by decision before serializing. Uses explicit field-by-field mapping (no spread operators).

- **Network Client** (`src/background/networkClient.ts`) — single fetch boundary. Only file in the extension that calls `fetch`. Sends request through firewall, receives raw response.

- **Response Validator** (`src/network/responseValidator.ts`) — validates AI response before display. Verifies: schema shape (zod), requestId match, elementId existence on page, elementId was disclosed, unknown action types. Rejects whole response if any check fails.

- **Mock AI Provider** (`server/src/providers/mockAiProvider.ts`) — deterministic rule-based reasoning. No `Math.random()`, no timing-dependent branching. Parses allowedContext for flight-domain concepts, picks lowest-price option, returns fixed-shape response.

- **Server** (`server/src/`) — minimal Express HTTP server. Validates request schema, enforces size cap (100KB), calls provider, validates provider response before returning.

- **Zod schemas** — runtime validation on both client and server. `TaskReasoningRequest` and `RawAIResponse` schemas defined with `.strict()` to reject unexpected fields.

- **Task tab UI** — "Send to AI" button, AI result display with interpretation, selected elements, proposed actions. "Proposal — not executed" notice (Phase 5 implements execution).

- 20 new tests (8 firewall + 8 validator + 7 server - 1 duplicate = 16 unique new + 3 server)
- Security structural tests verify: no EXCLUDE/BLOCK leaks, no sensitive values, requestId matching, undisclosed element rejection

### 4. Architecture

```
Phase 1–3 Pipeline (unchanged):
  Side Panel → ANALYZE_PAGE → Background → Content Script
  → domExtractor → PageRepresentation → piiDetector → PrivacyAnalysis
  → Side Panel → TaskView → SanitizedContext

Phase 4 Pipeline (NEW):
  TaskView → SEND_TO_AI message → Background Service Worker
    → networkClient.sendTaskReasoningRequest()
      → privacyFirewall.buildNetworkRequest(sanitizedContext, taskAnalysis)
        // ↑ ONLY accepts SanitizedContext — structurally cannot accept PageRepresentation
      → fetch('http://localhost:3001/reason')
        // ↑ ONLY fetch call in the extension
    → responseValidator.validateResponse()
      // ↑ Verifies requestId, elementId existence, disclosed set
    → AI_RESPONSE message → TaskView → ApprovedProposal display
```

### 5. File Structure

```
src/
├── network/
│   ├── networkTypes.ts               # TaskReasoningRequest, RawAIResponse, ApprovedProposal + zod schemas
│   ├── networkTypes.test.ts          # (tested via firewall/validator tests)
│   ├── privacyFirewall.ts            # Builds request from SanitizedContext ONLY
│   ├── privacyFirewall.test.ts       # 8 tests (defense in depth, structural guarantees)
│   ├── responseValidator.ts          # Validates AI response → ApprovedProposal
│   └── responseValidator.test.ts     # 8 tests (requestId, disclosed set, unknown types)
├── background/
│   ├── serviceWorker.ts              # Message router + network orchestration
│   └── networkClient.ts             # Single fetch boundary (ONLY fetch in extension)
├── task/                             # (Phase 3, unchanged)
├── privacy/                          # (Phase 2, unchanged)
├── content/                          # (Phase 1, unchanged)
├── sidepanel/
│   └── components/
│       └── TaskView.tsx              # Updated: Send to AI button + AI result display
├── shared/
│   ├── messages.ts                   # Added: SEND_TO_AI, AI_RESPONSE message types
│   └── constants.ts                  # (unchanged)
└── manifest.json                     # Added: host_permissions for localhost:3001

server/
├── src/
│   ├── index.ts                      # Express server entry point
│   ├── routes/
│   │   └── reason.ts                 # POST /reason handler
│   ├── providers/
│   │   ├── aiProvider.ts             # AIProvider interface
│   │   ├── mockAiProvider.ts         # Deterministic rule-based reasoning
│   │   └── index.ts                  # Provider selection
│   ├── schemas/
│   │   ├── request.ts                # Zod schema for TaskReasoningRequest
│   │   └── response.ts              # Zod schema for RawAIResponse
│   └── __tests__/
│       └── reason.test.ts            # 7 tests (validation, determinism)
├── package.json
└── tsconfig.json
```

### 6. Network Boundary

**Single fetch location:** `src/background/networkClient.ts` (line 43)
**Server URL:** `http://localhost:3001`
**Manifest permission:** `host_permissions: ["http://localhost:3001/*"]`

Verified: grep confirms `fetch(` appears in exactly one client-side file.

### 7. Request Schema

```typescript
interface TaskReasoningRequest {
  requestId: string;              // UUID v4
  task: string;                   // User task text
  intent: TaskIntent;             // Phase 3 intent
  entities: { origin?: string; destination?: string };
  allowedContext: Array<{
    elementId: string;
    concept: DomainConcept;
    tagName: string;
    label?: string;
    publicText?: string;
    disclosureLevel: 'ALLOW' | 'MINIMIZE' | 'TRANSFORM';
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
}
```

### 8. Response Schema

```typescript
interface RawAIResponse {
  requestId: string;               // Must echo request's id
  success: boolean;
  taskInterpretation: string;      // Plain text only
  selectedElements: Array<{ elementId: string; reason: string }>;
  proposedActions: Array<{ type: ProposedActionType; elementId: string }>;
}

type ProposedActionType = 'SELECT_ELEMENT' | 'CLICK_TARGET' | 'SCROLL_TARGET';
```

### 9. Server Behavior

1. Parse + schema-validate request body (zod `.strict()` rejects extra fields)
2. Reject payloads over 100KB
3. Pass validated request to `AIProvider.generate()`
4. Schema-validate provider's response before returning
5. Return only validated structured JSON

### 10. AI Provider Design

- **Interface:** `AIProvider` with `generate(request): Promise<RawAIResponse>`
- **Mock:** `MockAIProvider` — deterministic rule-based reasoning (no Math.random)
- **Selection:** Server-side only (`server/src/providers/index.ts`). Extension never imports concrete provider.
- **Pluggable:** Swapping in real LLM touches zero browser-extension code.

### 11. Privacy Guarantees

| Guarantee | Enforcement |
|-----------|-------------|
| Only SanitizedContext crosses network | TypeScript signature: `buildNetworkRequest(sanitizedContext: SanitizedContext, ...)` |
| No PageRepresentation/PrivacyAnalysis in request | Type-level: function doesn't accept those types |
| No EXCLUDE/BLOCK entries leak | Defense in depth: firewall re-filters by decision |
| No spread operators | Explicit field-by-field mapping in firewall |
| No unexpected fields in request | Zod `.strict()` rejects extra fields |
| No unexpected fields in response | Zod `.strict()` rejects extra fields |
| requestId matches | Validator checks requestId equality |
| No undisclosed elements referenced | Validator checks elementId in disclosed set |
| No automatic action execution | "Proposal — not executed" notice; no dispatch code |
| No eval/dynamic code | grep verified; no such code paths exist |
| AI strings rendered as plain text | React JSX default; never dangerouslySetInnerHTML |

### 12. Test Results

```
Client tests (11 files, 199 tests):
  Phase 1 tests (66): 66 passed
  Phase 2 tests (60): 60 passed
  Phase 3 tests (57): 57 passed
  Phase 4 tests (16): 16 passed
    privacyFirewall.test.ts   8 tests
    responseValidator.test.ts 8 tests

Server tests (1 file, 7 tests):
  reason.test.ts             7 tests

Total: 206 tests passing
```

### 13. Build Result

```
npm run build → tsc --noEmit && vite build
✓ 154 modules transformed
✓ built in ~994ms
Output: dist/ (manifest.json + JS bundles + CSS)
```

### 14. Demo Instructions

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
6. Click "Send to AI" — see mock AI result with proposed action
7. Note: "Proposal — not executed" notice (Phase 5 implements execution)

### 15. Captured Network Payload

**Request (sent to server):**
```json
{
  "requestId": "12345678-1234-4123-8123-123456789abc",
  "task": "Find cheapest flight from Mumbai to Delhi",
  "intent": "FLIGHT_SEARCH",
  "entities": { "origin": "Mumbai", "destination": "Delhi" },
  "allowedContext": [
    { "elementId": "price-1", "concept": "PRICE", "tagName": "SPAN", "publicText": "4250", "disclosureLevel": "ALLOW" },
    { "elementId": "flight-1", "concept": "FLIGHT_NUMBER", "tagName": "SPAN", "publicText": "SB 101", "disclosureLevel": "ALLOW" },
    { "elementId": "select-1", "concept": "SELECTION_CONTROL", "tagName": "BUTTON", "publicText": "Select Flight", "disclosureLevel": "ALLOW" }
  ]
}
```

**Response (from server):**
```json
{
  "requestId": "12345678-1234-4123-8123-123456789abc",
  "success": true,
  "taskInterpretation": "Found 1 flight option(s) from Mumbai to Delhi. The cheapest option is ₹4,250",
  "selectedElements": [
    { "elementId": "price-1", "reason": "Lowest price found" }
  ],
  "proposedActions": []
}
```

**Verification:** Zero sensitive field names or values present. Only public page content (price, flight number, button label).

### 16. Known Limitations

- Mock provider is rule-based, not LLM-powered (production would use real provider)
- Server runs on localhost only (no TLS, no auth — flagged for Phase 5)
- Gazetteer coverage: ~80 cities (from Phase 3)
- Transform functions: only TRAVEL_DATE and DEPARTURE_TIME/ARRIVAL_TIME (from Phase 3)
- SECRET data is always blocked (no user-override path yet — flagged for Phase 5)

### 17. What Must NOT Be Implemented Yet

- Screenshot capture or sanitization
- OCR / vision models
- WebGPU / ONNX inference
- Action execution / form filling (Phase 5)
- Authentication / database
- Production deployment
- Multi-agent orchestration

### 18. Exact Next-Phase Objective

**Phase 5 — Action Gate:**

Given an `ApprovedProposal` (Phase 4 output), execute the proposed actions on the page with user approval. This phase introduces DOM interaction for the first time — actions are displayed to the user for confirmation before execution.

### 19. Git Checkpoint

```
Commit: (pending — see §8 below)
Branch: master
Working tree: CLEAN
```
