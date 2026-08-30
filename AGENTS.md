# AGENTS.md

## PROJECT
Privacy-Preserving Browser Agent

## CURRENT STATUS
Phase 5 complete and frozen.

## RULES

1. Preserve Phase 1 functionality.
2. Preserve Phase 2 functionality.
3. Preserve Phase 3 functionality.
4. Preserve Phase 4 functionality.
5. Do not unnecessarily rewrite working code.
6. Do not remove existing tests.
7. Run the complete test suite after changes.
8. Run `npm run build` after significant changes.
9. Never log raw sensitive values.
10. Never transmit sensitive data without explicit implementation approval.
11. Do not implement Phase 5 automatically.
12. Make incremental changes.
13. Preserve the existing architecture unless there is a concrete technical reason to change it.

## CURRENT TEST BASELINE
235/235 passing (228 client + 7 server).

## CURRENT PHASE
Phase 5 — Local Vision Context + Action Gate (COMPLETE)

## NEXT PHASE
Future work (see Phase 5 Final Report)

## KEY ARCHITECTURAL DECISIONS

- Phase 1 types (`PageElement`, `PageRepresentation`) in `src/shared/types.ts` are frozen
- Phase 2 types (`PrivacyAssessment`, `PrivacyAnalysis`) in `src/privacy/privacyTypes.ts` are stored separately, joined by `elementId`
- Phase 3 types (`TaskAnalysisResult`, `DisclosurePlan`, `SanitizedContext`) in `src/task/taskTypes.ts` are the third state layer, joined by `elementId`
- Phase 4 types (`TaskReasoningRequest`, `RawAIResponse`, `ApprovedProposal`) in `src/network/networkTypes.ts` are the network boundary types
- Never merge Phase 2 data into Phase 1 types — keep them as sibling state objects
- Never merge Phase 3 data into Phase 1 or 2 types — keep them as sibling state objects
- **Phase 4 security invariant:** Only SanitizedContext crosses the network boundary. Single fetch file. No automatic action execution.
- **Phase 5 security invariant:** Only CLICK/SCROLL/SELECT actions allowed. User must approve all actions. Sensitive elements cannot be acted upon.
- Rule tables in `src/privacy/rules/` and `src/task/` are data tables, not code branches
- `evidenceExtractor.ts` touches the DOM; everything downstream is pure functions
- `disclosurePolicy.ts` contains the decision matrix — point-at-able during demo Q&A
- **Phase 3 security invariant:** Raw user-entered or identity-bearing data NEVER enters SanitizedContext
- **Phase 4 design decision:** Provider selection is server-side only. Extension never imports concrete provider.
- Phase 3 is flight-booking-specific for the hackathon — not a general-purpose ontology

## FILE LOCATIONS

- Action gate: `src/action/`
- Vision context: `src/vision/`
- Content scripts: `src/content/`
- Privacy engine: `src/privacy/`
- Task analysis: `src/task/`
- Network layer: `src/network/`
- Background: `src/background/`
- Side panel UI: `src/sidepanel/`
- Shared types: `src/shared/`
- Demo site: `src/demo/flight-booking/`
- Server: `server/`
- Tests: `src/**/*.test.ts` + `server/src/__tests__/`
- Build output: `dist/`

## COMMANDS

```bash
npm run build       # TypeScript check + Vite build
npm run test        # Run all client tests (vitest run)
npm run test:watch  # Watch mode
npm run demo        # Serve demo site at http://localhost:8080
npm run typecheck   # TypeScript check only
cd server && npm start   # Start mock AI server on http://localhost:3001
cd server && npm test    # Run server tests
```
