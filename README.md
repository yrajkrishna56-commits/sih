# Privacy-Preserving Browser Agent (PPBA) 🛡️

> **Smart India Hackathon (SIH) Project** — A local-first, privacy-preserving browser agent extension (Manifest V3) that perceives web pages, filters PII locally, enforces user authorization via cryptographic single-use tokens, and safely interacts with remote AI providers.

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

## 📖 How to Use the Project (Step-by-Step Guide)

### Step 1: Install Dependencies
Open your terminal in the project root directory and run:
```bash
# Install extension dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

---

### Step 2: Build the Extension Bundle
Build the Chrome extension code to produce the production `dist/` directory:
```bash
npm run build
```
*(This compiles TypeScript and Vite assets into the `dist/` folder).*

---

### Step 3: Load the Extension into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions` in the address bar.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the **`dist`** folder located inside this project directory (`sih-phase5-final/dist`).
5. The **Privacy-Preserving Browser Agent 🛡️** icon will now appear in your extension toolbar.

---

### Step 4: Launch the Local Servers
Run the flight booking demo site and the mock AI reasoning server in separate terminal windows:

#### Terminal 1 (Demo Website):
```bash
npm run demo
```
*(Serves the synthetic flight booking site at `http://localhost:8080`)*

#### Terminal 2 (Mock AI Server):
```bash
cd server && npm start
```
*(Runs the AI reasoning backend at `http://localhost:3001`)*

---

### Step 5: Run the Live Privacy Agent Workflow
1. Open Chrome and navigate to **`http://localhost:8080`**.
2. **Fill in Passenger Form (Synthetic Secrets):**
   - **Full Name:** `John Doe`
   - **Email:** `john.doe@example.com`
   - **Phone:** `+91 9876543210`
   - **Passport Number:** `P1234567`
   - **Card Number:** `4242424242424242`
   - **CVV:** `123`
   - **Password:** `SuperSecretPassword123!`
3. **Open the Extension Side Panel:**
   - Click the extension toolbar icon (🛡️) to open the side panel UI.
4. **Run Local Page Analysis:**
   - Click **🔍 Analyze Current Page**.
   - Switch to the **Privacy Tab** to inspect local PII detection results. Notice how Passport, Credit Card, and Passwords are classified locally as `SECRET` / `PERSONAL`.
5. **Execute Task Analysis:**
   - Go to the **Task View** tab.
   - Enter your prompt: **`Find the cheapest flight from Mumbai to Delhi`**.
   - Click **Analyze Task & Reason**.
6. **Review & Approve Action:**
   - The UI shows the classified intent (`FLIGHT_SEARCH`) and minimum disclosure summary.
   - The AI proposes selecting the cheapest flight (`SkyBook SB-101` for `₹4,250`).
   - Click **Approve Action**. The background service worker validates a single-use authorization token and securely clicks the flight button on the page!

---

### Step 6: How to Verify Zero PII Leakage Yourself
You can independently verify that your personal data never leaves your browser:
1. On the demo page (`http://localhost:8080`), press `F12` to open **Chrome DevTools**.
2. Go to the **Network** tab and filter by **`Fetch/XHR`**.
3. Clear the network log, then click **Analyze Task & Reason** in the extension.
4. Click the outgoing request sent to `http://localhost:3001/reason`.
5. Inspect the **Payload** / **Request Body**.
6. Search for `John Doe`, `john.doe@example.com`, or `4242424242424242`.
7. **Result:** You will find **0 occurrences**. Only public flight schedules and prices are included in the cloud request.

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
