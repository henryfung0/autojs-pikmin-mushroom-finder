# Throw Plant Flow — Implementation Plan

## TL;DR

> **Quick Summary**: Add a new "Throw Plant" mode that navigates to the plant page, detects throw items (from `templates/throw plant/throw/`), clicks matched items, scrolls to find flow.jpg, clicks it, then returns to plant page.
>
> **Deliverables**:
> - `advanture/throw_plant_flow.js` — core throw plant flow logic
> - `advanture/throw_plant_main.js` — thin orchestrator (setup → flow → cleanup)
> - `advanture/main.js` — add Throw Plant dispatch
> - `ui/config_ui.js` — add "Throw Plant" option to mode spinner
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES (Flow and Orchestrator are separate files)
> **Critical Path**: config_ui → main dispatch → throw_plant_main → throw_plant_flow

---

## Context

### Original Request
User wants a new function named "throw plant" that:
1. Ensure on main page
2. Navigate to plant page — click images in `plant page clicker/` folder repeatedly until `plant page checker.jpg` is visible (DO NOT click it)
3. Detect matched images in `throw/` folder — if found, click it
4. After clicking throw item → scroll down a few times → click `flow.jpg`
5. Click `flow.jpg` → then run "common function for going back to plant page"
6. If no throw item detected → scroll down a bit → check again
7. Follow existing code patterns (use existing `_matchOne`, `_loadTemplatesFromDir`, `_tapAt`, etc.)

### Template Folder Structure
```
templates/throw plant/
├── navigation/
│   ├── plant page checker.jpg   ← arrival detector (check ONLY, do NOT click)
│   └── flow.jpg                 ← confirm button after selecting throw item
├── plant page clicker/
│   ├── To plant page.jpg        ← click repeatedly to navigate to plant page
│   └── Plant page.jpg           ← alternative nav button
└── throw/
    ├── Gallery_1783395463997.jpg
    ├── Gallery_1783395426767.jpg
    ├── Gallery_1783395398240.jpg
    ├── Gallery_1783395369916.jpg
    ├── Gallery_1783395325969.jpg
    └── cloth.jpg
```

### Existing Code Patterns to Follow
- `advanture/advanture_flow.js` — template loading (`_loadTemplatesFromDir`), matching (`_matchOne`), tapping (`_tapAt`), scroll, flow orchestration
- `advanture/advanture_state.js` — `isOnMainPage` for main page nav, state detection pattern
- `ui/floaty.js` — `appendLog`, `updateStatus`, `withPanelHidden`, `destroy`
- `ui/config.js` — `advConfig` namespace for UI constants

---

## Work Objectives

### Core Objective
Add a new "Throw Plant" mode accessible from the config dialog, which runs a dedicated flow to collect throw plant items.

### Concrete Deliverables
1. `advanture/throw_plant_flow.js` — exported `runThrowPlantFlow(config, panel)` function
2. `advanture/throw_plant_main.js` — thin orchestrator with setup/cleanup phases
3. Update `ui/config_ui.js` — add "Throw Plant" to spinner entries
4. Update `main.js` — dispatch to `throw_plant_main.run()` when mode === "Throw Plant"

### Definition of Done
- [ ] Config spinner shows "Throw Plant" as third option
- [ ] Selecting "Throw Plant" → Start → calls `throw_plant_main.run()`
- [ ] Flow navigates to plant page via plant page clicker
- [ ] Flow detects throw items and clicks them
- [ ] After throw item click → scrolls → clicks flow.jpg
- [ ] After flow.jpg → returns to plant page via common dismiss buttons
- [ ] Max empty loops → back to main page, standby

### Must Have
- Follow existing `advanture_flow.js` code patterns exactly (helpers, template loading, error handling)
- Volume key interrupt support (same as advanture_flow)
- Graceful shutdown via `_shutdownRequested`
- Reuse `advState.isOnMainPage()` for main page nav
- Reuse `templates/common/` dismiss buttons for "return to plant page"

### Must NOT Have
- Do NOT click `plant page checker.jpg` — only check if it exists
- Do NOT add as sub-feature inside advanture_flow — must be separate mode
- Do not invent new helpers if existing ones suffice

---

## Execution Strategy

### Files to Create (2 new files)
1. `advanture/throw_plant_flow.js` — core flow logic
2. `advanture/throw_plant_main.js` — setup/cleanup orchestrator

### Files to Modify (2 existing files)
3. `ui/config_ui.js` — add "Throw Plant" to spinner
4. `main.js` — add dispatch case

### Parallelization
- `throw_plant_flow.js` and `throw_plant_main.js` are written sequentially (flow first, then orchestrator wraps it)
- Config UI and main.js updates are independent of the new flow files

---

## TODOs

- [x] 1. Create `advanture/throw_plant_flow.js`

  **What to do**:
  - Copy the file header comment style from `advanture/advanture_flow.js`
  - Add volume key interrupt (same as advanture_flow: `_shutdownRequested`, `events.observeKey`, `onKeyDown "volume_up"`)
  - Add internal helpers: `_showTap`, `_matchOne`, `_loadTemplatesFromDir`, `_tapAt` (copy from advanture_flow.js — they are identical)
  - Add `loadThrowPlantTemplates(templateDir)` — loads 5 template groups:
    - `plantPageClicker` from `throw plant/plant page clicker/`
    - `plantPageChecker` from `throw plant/navigation/` (filter for "plant page checker" only)
    - `throwItems` from `throw plant/throw/`
    - `flow` from `throw plant/navigation/` (filter for "flow")
    - `common` from `common/`
    - `mainNav` from `navigation/`
  - Add `navigateToPlantPage(templates, mainNavTemplates, panel)`:
    - Loop: capture screen → check if `plant page checker` visible (just `_matchOne`, do NOT click it)
    - If NOT visible: click `plantPageClicker` templates in round-robin until checker appears
    - If no clicker found: use common dismiss buttons to make progress
    - Returns `true` when plant page checker is visible
    - Timeout: 60s, then return false
  - Add `returnToPlantPage(templates, panel)`:
    - After flow.jpg clicked — loop: capture → check if plant page checker visible
    - If NOT visible: click common dismiss buttons (non-close/back first, then close/back fallback)
    - Returns `true` when plant page checker visible again
    - Timeout: 60s, then return false
  - Add `findThrowItem(screenImage, throwTemplates, config)`:
    - For each template in throwTemplates, `_matchOne` with threshold from config (default 0.7)
    - Return first match (no priority order needed)
  - Add `clickFlowButton(templates, panel)`:
    - Find template in `templates.flow` where name contains "flow"
    - `_matchOne` on current screen → if found, `_tapAt`
    - Return `true` if clicked, `false` if not found
  - Add `runThrowPlantFlow(config, panel)` main function:
    - Load templates via `loadThrowPlantTemplates`
    - Ensure on main page: `advState.isOnMainPage(mainNavTemplates, {...})`
    - Navigate to plant page: `navigateToPlantPage(...)` — if fails, log error and return
    - Main loop (while `!_shutdownRequested`):
      - Capture screen → `findThrowItem`
      - If throw item found:
        - Reset `emptyLoopCount = 0`
        - Update status: "THROW ITEM Found!"
        - `_tapAt(match, "Tap throw item: " + match.name, panel)`
        - Sleep 2000
        - Scroll down (same 2/3 scroll: Y=0.8 → Y=0.47)
        - `clickFlowButton(templates, panel)` — if not found, scroll again and retry
        - Sleep 2000
        - `returnToPlantPage(templates, panel)` — loop until back or timeout
        - Sleep 1000
      - If no throw item found:
        - Scroll down (same 2/3 scroll)
        - `emptyLoopCount++`
        - If `emptyLoopCount >= 10`: log, `advState.isOnMainPage(...)`, `break`
    - At shutdown: `floatyMod.updateStatus(panel, "Stopped")`
  - Export: `module.exports = { runThrowPlantFlow: runThrowPlantFlow }`

  **Must NOT do**:
  - Do NOT click plant page checker.jpg
  - Do NOT invent new helper functions already available in advanture_flow.js
  - Do NOT add throw plant as sub-mode inside advanture_flow

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `gitnexus/gitnexus-refactoring` — for safely creating new file following existing patterns
  - Reason: New file creation with specific naming conventions and code patterns to match

  **Parallelization**:
  - **Can Run In Parallel**: NO — sequential (flow file must exist before orchestrator)
  - **Blocks**: Task 2 (throw_plant_main.js)

  **References**:
  - `advanture/advanture_flow.js:52-68` — `_showTap` helper pattern
  - `advanture/advanture_flow.js:70-93` — `_matchOne` helper pattern
  - `advanture/advanture_flow.js:95-128` — `_loadTemplatesFromDir` helper pattern
  - `advanture/advanture_flow.js:134-148` — `_tapAt` helper pattern
  - `advanture/advanture_flow.js:154-162` — `loadAdventureTemplates` pattern
  - `advanture/advanture_state.js:88-185` — `isOnMainPage` pattern (for reuse)
  - `advanture/advanture_flow.js:366-503` — `runAdvantureFlow` structure (follow same while loop pattern)
  - `templates/throw plant/` — template folder structure

  **Acceptance Criteria**:
  - [ ] File created: `advanture/throw_plant_flow.js`
  - [ ] `module.exports` exports `runThrowPlantFlow`
  - [ ] `navigateToPlantPage` does NOT click plant page checker
  - [ ] `returnToPlantPage` uses common templates for dismiss
  - [ ] Same 2/3 scroll (Y 0.8→0.47) used consistently
  - [ ] Max 10 empty loops triggers return to main page and break

  **QA Scenarios**:
  ```
  Scenario: Navigate to plant page — checker found immediately
    Tool: interactive_bash (tmux) — simulate screen with plant page checker visible
    Preconditions: Running throw_plant_flow, on main page
    Steps:
      1. Start runThrowPlantFlow with config
      2. Verify isOnMainPage called
      3. Verify navigateToPlantPage enters loop
      4. Simulate plant page checker visible on screen
      5. Verify navigateToPlantPage returns true
    Expected Result: Flow proceeds to scan for throw items
    Evidence: .sisyphus/evidence/task-1-plant-nav-success.txt

  Scenario: Navigate to plant page — requires multiple clicks
    Tool: interactive_bash (tmux)
    Preconditions: Running throw_plant_flow, on main page
    Steps:
      1. Start runThrowPlantFlow
      2. Simulate plant page checker NOT visible initially
      3. Verify plant page clicker templates are clicked in round-robin
      4. After 3 clicks, simulate plant page checker visible
      5. Verify navigateToPlantPage returns true
    Expected Result: Clicker clicked 3 times before checker found
    Evidence: .sisyphus/evidence/task-1-plant-nav-clicks.txt

  Scenario: Throw item found and clicked
    Tool: interactive_bash (tmux)
    Preconditions: On plant page, throw item visible
    Steps:
      1. Start runThrowPlantFlow, skip nav (mock navigateToPlantPage=true)
      2. Simulate throw item (cloth.jpg) visible on screen
      3. Verify findThrowItem returns match
      4. Verify _tapAt called for the throw item
      5. Verify scroll (2/3) executed
      6. Verify clickFlowButton called
    Expected Result: Throw item tapped, scrolled, flow.jpg clicked
    Evidence: .sisyphus/evidence/task-1-throw-item-found.txt

  Scenario: No throw item found — scroll and retry
    Tool: interactive_bash (tmux)
    Preconditions: On plant page, no throw item visible
    Steps:
      1. Start runThrowPlantFlow, mock navigateToPlantPage=true
      2. Simulate no throw item on first capture
      3. Verify 2/3 scroll executed
      4. Simulate still no throw item
      5. Verify emptyLoopCount incremented
      6. Verify scroll executed again
    Expected Result: Scroll happens, emptyLoopCount increases
    Evidence: .sisyphus/evidence/task-1-no-throw-scroll.txt

  Scenario: Max empty loops reached
    Tool: interactive_bash (tmux)
    Preconditions: On plant page, no throw items at all
    Steps:
      1. Start runThrowPlantFlow, mock navigateToPlantPage=true
      2. Simulate no throw item for 10 consecutive loops
      3. Verify after 10th empty loop: isOnMainPage called
      4. Verify break exits the while loop
      5. Verify "Stopped" status updated
    Expected Result: After 10 empty loops, returns to main page and stops
    Evidence: .sisyphus/evidence/task-1-max-loops.txt
  ```

  **Commit**: NO (group with Task 2 and 3)

- [x] 2. Create `advanture/throw_plant_main.js`

  **What to do**:
  - Follow `advanture/main.js` structure exactly (setup → launch → flow → cleanup)
  - Module imports:
    ```javascript
    var config      = require("../ui/config");
    var matcher     = require("../lib/matcher");
    var floatyMod   = require("../ui/floaty");
    var throwFlow   = require("./throw_plant_flow");
    ```
  - Add `cleanupAndExit(panel, statusText, toastMsg)` function — identical to advanture/main.js
  - Add `run(settings)` function:
    - Merge UI settings into config (threshold, settleDelay from settings)
    - Phase 1 — Setup:
      - Load templates via `matcher.loadAllTemplates(templateDir, { excludeDirs: [] })`
      - If no templates: toast error + exit
      - Create floaty panel
    - Phase 2 — Launch:
      - `images.requestScreenCapture(false)` — if denied, cleanupAndExit
      - If `settings.autoLaunch`: launch Pikmin Bloom package, sleep 3000
    - Phase 3 — Flow:
      - Call `throwFlow.runThrowPlantFlow(config, panel)`
    - Phase 4 — Cleanup:
      - `floatyMod.appendLog(panel, "Throw plant finished")`
      - `sleep(3000)`, `floatyMod.destroy(panel)`
  - Export: `module.exports = { run: run }`

  **Must NOT do**:
  - Do NOT add throw plant settings to config.js — no new config needed
  - Do NOT duplicate logic already in advanture/main.js

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Skills: none — simple file creation following existing pattern

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on Task 1 (throw_plant_flow.js must exist first)
  - **Blocks**: Task 3 (config_ui.js update is independent, can run in parallel with this)

  **References**:
  - `advanture/main.js:21-33` — `cleanupAndExit` function
  - `advanture/main.js:35-153` — `run(settings)` function structure

  **Acceptance Criteria**:
  - [ ] File created: `advanture/throw_plant_main.js`
  - [ ] `module.exports = { run: run }`
  - [ ] Calls `throwFlow.runThrowPlantFlow(config, panel)` in Phase 3
  - [ ] `cleanupAndExit` works exactly like advanture/main.js version

  **QA Scenarios**:
  ```
  Scenario: Throw plant main starts and runs flow
    Tool: interactive_bash (tmux)
    Preconditions: None (clean state)
    Steps:
      1. Call throw_plant_main.run({ autoLaunch: false })
      2. Verify templates loaded
      3. Verify panel created
      4. Verify screen capture requested
      5. Verify throwFlow.runThrowPlantFlow called
      6. Verify cleanup/destroy at end
    Expected Result: Full lifecycle completes
    Evidence: .sisyphus/evidence/task-2-main-lifecycle.txt
  ```

  **Commit**: NO (group with Task 1 and 3)

- [x] 3. Update `ui/config_ui.js` — add "Throw Plant" to mode spinner

  **What to do**:
  - In `showConfigDialog()`, find the spinner definition:
    ```javascript
    <spinner id="modeSelector" entries="Mushroom Finder|Advanture"
    ```
  - Change to:
    ```javascript
    <spinner id="modeSelector" entries="Mushroom Finder|Advanture|Throw Plant"
    ```
  - In the `setOnItemSelectedListener` onItemSelected handler:
    - Change `else` (Advanture) branch to check `position === 1`
    - Add new `else if (position === 2)` for "Throw Plant" — set `advantureSettings.visibility = android.view.View.GONE` (Throw Plant has no specific settings)

  **Must NOT do**:
  - Do NOT add Throw Plant-specific settings to the UI — no new config options needed
  - Do NOT change the spinner default (it should still default to Advanture)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Skills: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 1 and 2)

  **References**:
  - `ui/config_ui.js:34-35` — spinner definition
  - `ui/config_ui.js:113-123` — onItemSelectedListener

  **Acceptance Criteria**:
  - [ ] Spinner shows 3 options: "Mushroom Finder", "Advanture", "Throw Plant"
  - [ ] Selecting "Throw Plant" hides both mushroom and adventure settings panels

  **QA Scenarios**:
  ```
  Scenario: Config dialog shows Throw Plant option
    Tool: interactive_bash (tmux) — ui automation test
    Preconditions: config_ui.js updated
    Steps:
      1. Open config dialog
      2. Check spinner has 3 options
      3. Select "Throw Plant"
      4. Verify mushroomSettings hidden
      5. Verify advantureSettings hidden
    Expected Result: All settings panels hidden for Throw Plant mode
    Evidence: .sisyphus/evidence/task-3-spinner-options.txt
  ```

  **Commit**: NO (group with Task 1 and 2)

- [x] 4. Update `main.js` — add Throw Plant dispatch

  **What to do**:
  - In `main.js`, add a new case in the dispatch:
    ```javascript
    if (settings.mode === "Advanture") {
      require("./advanture/main").run(settings);
    } else if (settings.mode === "Throw Plant") {
      require("./advanture/throw_plant_main").run(settings);
    } else {
      require("./mushroom_finder/main").run(settings);
    }
    ```

  **Must NOT do**:
  - Do NOT change existing Mushroom Finder or Advanture dispatch logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Skills: none

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 1-3)

  **References**:
  - `main.js:27-30` — existing dispatch logic

  **Acceptance Criteria**:
  - [ ] `settings.mode === "Throw Plant"` dispatches to `throw_plant_main.run(settings)`

  **QA Scenarios**:
  ```
  Scenario: Throw Plant dispatch works correctly
    Tool: interactive_bash (tmux)
    Preconditions: main.js updated
    Steps:
      1. Mock settings = { mode: "Throw Plant", autoLaunch: false }
      2. Call the dispatch logic
      3. Verify throw_plant_main.run was called
    Expected Result: Correct module loaded and run called
    Evidence: .sisyphus/evidence/task-4-dispatch.txt
  ```

  **Commit**: YES (all 4 files together)
  - Message: `feat(throw-plant): add throw plant flow mode`
  - Files: `advanture/throw_plant_flow.js`, `advanture/throw_plant_main.js`, `ui/config_ui.js`, `main.js`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `feat(throw-plant): add throw plant flow mode` — advanture/throw_plant_flow.js, advanture/throw_plant_main.js, ui/config_ui.js, main.js

---

## Success Criteria

- [ ] Config dialog spinner shows "Throw Plant" as third option
- [ ] Selecting "Throw Plant" hides both mushroom and adventure settings panels
- [ ] Dispatch correctly routes to `throw_plant_main.run(settings)`
- [ ] `runThrowPlantFlow` navigates to plant page via plant page clicker (not clicking checker)
- [ ] Throw items detected from `templates/throw plant/throw/` folder
- [ ] Matched throw item is clicked
- [ ] After throw item click: scrolls (2/3), clicks flow.jpg
- [ ] After flow.jpg: returns to plant page via common dismiss buttons
- [ ] Max 10 empty loops → back to main page, standby
- [ ] Volume key interrupt works


- [ ] F1. **Plan Compliance Audit** — `oracle`
- [ ] F2. **Code Quality Review** — `unspecified-high`
- [ ] F3. **Real Manual QA** — `unspecified-high`
- [ ] F4. **Scope Fidelity Check** — `deep`

---

## Commit Strategy

- **1**: `feat(throw-plant): add throw plant flow mode` — throw_plant_flow.js, throw_plant_main.js, config_ui.js, main.js

---

## Success Criteria

- Config dialog shows "Throw Plant" as third mode option
- Running Throw Plant mode executes the full flow: main page → plant page → detect throw → click → scroll → flow.jpg → back to plant page
- Volume Up interrupts the flow gracefully
- Max empty loops returns to main page and stops
