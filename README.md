# Privacy-Preserving Browser Agent (PPBA) 🛡️

> **Smart India Hackathon (SIH) Project** — A local-first, privacy-preserving browser agent extension (Manifest V3) that perceiving web pages, filters PII locally, enforces user authorization via cryptographic single-use tokens, and safely interacts with remote AI providers.

---

## 🌟 Architecture & Core Invariants

```
[DOM / Page Elements] ── Phase 1 ──> PageRepresentation (shared/types.ts)
                                           │ (joined by elementId)
[PII Classification]  ── Phase 2 ──> PrivacyAnalysis (privacy/privacyTypes.ts)
                                           │ (joined by elementId)
[Task & Disclosure]   ── Phase 3 ──> DisclosurePlan / SanitizedContext (task/taskTypes.ts)
                                           │
[Network Firewall]    ── Phase 4 ──> TaskReasoningRequest / RawAIResponse (network/networkTypes.ts)
                                           │
[Action Gate + UI]    ── Phase 5 ──> ValidatedAction + Single-Use Token (action/actionTypes.ts, approvalStore.ts)
```

### 🔐 Verified Security Guarantees
1. **Zero-PII Transmission:** Passwords, credit cards, passport numbers, and raw `.value` inputs NEVER cross the network boundary.
2. **Single Fetch Point:** All network access is strictly confined to `src/network/networkClient.ts`. No hidden background telemetry.
3. **Browser-as-Trust-Boundary:** Remote AI recommendations are strictly advisory. Un-disclosed or non-interactive elements are blocked by local Action Gate.
4. **Mechanism-Enforced User Approval:** Proposed actions require explicit user approval backed by background single-use cryptographic UUID tokens (`ApprovalStore`).
5. **Offline Visual Context:** Visual context is derived 100% offline from DOM bounding boxes (`x`, `y`, `width`, `height`), with sensitive regions masked locally.

---

## 📁 Repository Structure

```
src/
├── action/           # Phase 5: Action Gate & safety validators
├── background/       # MV3 Service Worker & ApprovalStore token manager
├── content/          # Content script, DOM extractor & highlighter overlay
├── demo/             # Local demo flight-booking site (http://localhost:8080)
├── network/          # Phase 4: Privacy firewall, network client & response validator
├── privacy/          # Phase 2: PII detection engine, confidence scoring & pattern rules
├── shared/           # Phase 1: Shared types, contracts & constants
├── sidepanel/        # React side panel UI, TaskView & inspector
├── task/             # Phase 3: Task analyzer, minimum disclosure policy & concept tagger
└── vision/           # Phase 5: Local visual context builder & redactor
server/               # Express mock AI server (http://localhost:3001)
```

---

## 🚀 Quick Start & Local Execution

### 1. Requirements
- **Node.js 18+**
- **Chrome 114+** (Manifest V3 Side Panel API)

### 2. Install Dependencies & Build Extension
```bash
# Install root client dependencies
npm install

# Install mock AI server dependencies
cd server && npm install && cd ..

# Build TypeScript & Vite extension bundle
npm run build
```

### 3. Load Extension in Chrome
1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the generated `dist/` directory.

### 4. Run Live Demo Environment
```bash
# Terminal 1: Serve flight booking demo site (http://localhost:8080)
npm run demo

# Terminal 2: Start mock AI server (http://localhost:3001)
cd server && npm start
```

### 5. Execute Test Suite
```bash
# Run client test suite (242 tests)
npm test

# Run server test suite (7 tests)
cd server && npm test
```

**Total Test Baseline:** **249/249 passing** (242 client + 7 server).

---

## 📜 Commands Reference

| Command | Action |
|---------|--------|
| `npm run build` | TypeScript check + Vite bundle (`dist/`) |
| `npm run test` | Run client unit & integration tests (`vitest run`) |
| `npm run demo` | Serve flight booking site at `http://localhost:8080` |
| `npm run typecheck` | Run `tsc --noEmit` check only |
| `cd server && npm start` | Start mock AI server on `http://localhost:3001` |
| `cd server && npm test` | Run backend schema & reasoning tests |

---

## 🛡️ License
SIH Prototype — Confidential & Proprietary.
