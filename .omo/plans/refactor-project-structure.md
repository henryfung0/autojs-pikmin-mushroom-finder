# Refactor Project Structure — Modular Restructuring

## TL;DR

> **Quick Summary**: Restructure the AutoJS6 Pikmin Bloom Mushroom Finder from flat files into a modular architecture with `lib/` (reusable utilities), `ui/` (UI components), and `mushroom_finder/` (domain logic). Ultra-thin root `main.js` dispatches to domain-specific `mushroom_finder/main.js`.
>
> **Deliverables**:
> - `lib/gestures.js` — scroll/zoom/swipe (from `scroll.js`)
> - `lib/matcher.js` — template matching with NMS (from `detection.js`, renamed `findTemplates`)
> - `lib/screen.js` — screenshot, brightness helpers (from `utils/utils.js` generic parts)
> - `mushroom_finder/screen_state.js` — Pikmin Bloom screen classification (from `utils/utils.js` specific parts)
> - `mushroom_finder/01_navigate_to_map.js` — map navigation (from `navigator.js`)
> - `mushroom_finder/02_scan_map.js` — scan loop (from `scanner.js`)
> - `mushroom_finder/03_handle_mushroom.js` — mushroom result handling (extracted from root `main.js`)
> - `mushroom_finder/main.js` — pipeline orchestration that calls 01→02→03 in order
> - Ultra-thin root `main.js` — dispatcher only
> - Deleted old root files, updated README
> - **Critical fix**: `lib/matcher.js` uses injected `regionFn` parameter instead of global `getGameMapRegion`
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves + final verification
> **Critical Path**: Task 1 → Task 3 → Task 6 → Task 8 → Task 9 → F1-F4

---

## Context

### Original Request
Refactor the project so reusable utilities live in `lib/`, UI components in `ui/`, and mushroom-finding business logic in `mushroom_finder/`. Root `main.js` should be ultra-thin (just dispatch), with the pipeline logic in `mushroom_finder/main.js`.

### Interview Summary
**Key Discussions**:
- `detection.js` → `lib/matcher.js` with `findMushrooms` renamed to `findTemplates`
- `scroll.js` → `lib/gestures.js`
- `utils/utils.js` split: generic helpers → `lib/screen.js`, mushroom-specific (`classifyScreenState`, `getGameMapRegion`) → `mushroom_finder/screen_state.js`
- `navigator.js` → `mushroom_finder/01_navigate_to_map.js`
- `scanner.js` → `mushroom_finder/02_scan_map.js`
- `mushroom_finder/03_handle_mushroom.js` — extracted from root `main.js`'s `onFound` callback
- Root `main.js` → ultra-thin dispatcher; pipeline logic → `mushroom_finder/main.js`
- `mushroom_finder/screen_state.js` imports `meanBrightness`/`terrainRatio` from `lib/screen.js`
- `lib/gestures.js` imports from `../ui/floaty` for logging (acceptable cross-dependency)

**Research Findings**:
- Branch `refactor/cleanup-dead-code` already has `ui/` and `utils/` subfolders
- `test_checkbox.js` already deleted on this branch

**Key Decisions**:
- `getGameMapRegion` global reference in `detection.js` (line 57-58) → resolved by injecting `regionFn` as optional parameter to `findTemplates()`
- Old root files deleted after move (no stubs)
- `nms()`, `loadAllTemplates()`, `recycleAllTemplates()` keep their names
- `project.json` left untouched
- README changes limited to structure tree only
- Singleton guard stays in root `main.js`

---

## Work Objectives

### Core Objective
Restructure flat project into modular architecture with clean separation of reusable utilities, UI components, and domain logic — zero behavior changes.

### Concrete Deliverables
- `lib/gestures.js` — functions: `scrollLeft`, `scrollRight`, `zoom`, `zoomOut`, `zoomIn`
- `lib/matcher.js` — functions: `loadAllTemplates`, `findTemplates` (renamed from `findMushrooms`), `nms`, `recycleAllTemplates`. Signature: `findTemplates(screenImage, templates, options?)` where `options.regionFn` is optional.
- `lib/screen.js` — functions: `saveScreenshotToGallery`, `meanBrightness`, `terrainRatio`
- `mushroom_finder/screen_state.js` — functions: `classifyScreenState`, `getGameMapRegion`
- `mushroom_finder/01_navigate_to_map.js` — functions: `loadNavigationTemplates`, `dismissPikminIcon`, `navigateToMap`, `waitForAndClickLarge`, `waitForAndClickOwnPosition`
- `mushroom_finder/02_scan_map.js` — functions: `startScanning`, `stopScanning`, `isScanning`, `wasUserStop`
- `mushroom_finder/03_handle_mushroom.js` — function: `handleMushroomFound(panel, match, capture, config)` — screenshot, toast, exit
- `mushroom_finder/main.js` — orchestrates pipeline: 01_navigate_to_map → 02_scan_map → 03_handle_mushroom
- Root `main.js` — ultra-thin: singleton guard → config dialog → dispatch to `mushroom_finder/main.js`

### Definition of Done
- [x] All files exist in their target locations per the structure tree
- [x] All old root files deleted (detection.js, navigator.js, scanner.js, scroll.js)
- [x] `utils/utils.js` deleted, `utils/` directory removed
- [x] Zero old require paths remain (`grep -rn 'require\("\.\/detection"\)' .` returns empty)
- [x] `lib/matcher.js` has zero references to global `getGameMapRegion`
- [x] `node --check main.js` passes syntax check
- [x] All module.exports keys match originals (except `findMushrooms` → `findTemplates`)
- [x] README structure tree updated

### Must Have
- **Zero behavior changes** — every function keeps its exact signature (params, returns) except `findMushrooms` → `findTemplates(options)` with optional `regionFn`
- **`getGameMapRegion` coupling resolved** — no global function references in `lib/matcher.js`
- **Old root files deleted** — no stale stubs left behind
- **Singleton guard stays in root main.js** — not in `mushroom_finder/main.js`
- **All require paths correct** — every import resolves to the right target

### Must NOT Have (Guardrails)
- No drive-by improvements (no touching volume keys, no changing zoom params, no "fixing" image recycling)
- No changes to `project.json`
- No changes to `templates/` directory
- No function signature changes beyond the explicitly specified `findMushrooms` → `findTemplates(options?)`
- No renaming of `nms()`, `loadAllTemplates()`, `recycleAllTemplates()`
- No reformatting code beyond file header updates
- No new features or behavior modifications
- No changes to config defaults or new config keys

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (AutoJS6 is not a Node.js project)
- **Automated tests**: None
- **Agent-Executed QA**: ALWAYS — via bash commands (grep, test, node --check)

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

Verification tools:
- Bash: `grep`, `test`, `diff`, `node --check` for syntax validation
- File comparison: `ls -R`, `git diff --stat` for structural verification
- Export validation: grep for `module.exports` keys in new files

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — create lib/ + mushroom_finder/ files):
├── Task 1: Create directories (lib/, mushroom_finder/) [quick]
├── Task 2: scroll.js → lib/gestures.js [quick]
├── Task 3: detection.js → lib/matcher.js + findMushrooms→findTemplates + regionFn [quick]
└── Task 4: Split utils/utils.js → lib/screen.js + mushroom_finder/screen_state.js [quick]

Wave 2 (Domain — move mushroom_finder files):
├── Task 5: navigator.js → mushroom_finder/01_navigate_to_map.js [quick]
├── Task 6: scanner.js → mushroom_finder/02_scan_map.js [quick]
├── Task 7: Create mushroom_finder/03_handle_mushroom.js [quick]
└── Task 8: Create mushroom_finder/main.js (orchestrator calling 01→02→03) [deep]

Wave 3 (Finalize — root files + cleanup):
├── Task 9: Rewrite root main.js as ultra-thin dispatcher [quick]
├── Task 10: Delete old root files + utils/ directory [quick]
└── Task 11: Update README.md structure tree [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: File structure & path audit (unspecified-high)
├── Task F3: Export/function integrity check (deep)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1**: - → 2, 3, 4 (Wave 1)
- **2, 3, 4**: 1 → 5, 6, 7 (Wave 2)
- **5, 6, 7, 8**: 2, 3, 4 → 9, 10, 11 (Wave 3)
- **8, 9**: 3, 4, 5, 6 → F1-F4 (Final Wave)

### Agent Dispatch Summary
- **Wave 1**: **4** agents — Task 1 → `quick`, 2 → `quick`, 3 → `quick`, 4 → `quick`
- **Wave 2**: **4** agents — Task 5 → `quick`, 6 → `quick`, 7 → `quick`, 8 → `deep`
- **Wave 3**: **3** agents — Task 9 → `quick`, 10 → `quick`, 11 → `quick`
- **FINAL**: **4** agents — F1 → `oracle`, F2 → `unspecified-high`, F3 → `deep`, F4 → `deep`

---

## TODOs

- [x] 1. Create directories `lib/` and `mushroom_finder/`

  **What to do**:
  - `mkdir lib mushroom_finder`
  - Verify they exist with `ls -d lib/ mushroom_finder/`

  **Must NOT do**:
  - Do not create any other directories

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial directory creation
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-4)
  - **Blocks**: Tasks 2, 3, 4 (they all need the directories to exist, but can run concurrently since mkdir is instant)
  - **Blocked By**: None (can start immediately)

  **References**: None

  **Acceptance Criteria**:
  - [ ] `ls -d lib/` returns success
  - [ ] `ls -d mushroom_finder/` returns success

  **QA Scenarios**:
  ```
  Scenario: Directories created
    Tool: Bash
    Preconditions: Working directory is project root
    Steps:
      1. `test -d lib && test -d mushroom_finder`
    Expected Result: Exit code 0
    Evidence: .omo/evidence/task-1-dirs-created.txt
  ```

  **Commit**: YES
  - Message: `chore: create lib/ and mushroom_finder/ directories`
  - Files: (empty — just directory creation, git tracks dirs by their files only)

---

- [x] 2. Move `scroll.js` → `lib/gestures.js`

  **What to do**:
  - `git mv scroll.js lib/gestures.js`
  - Update file header comment from `scroll.js` to `lib/gestures.js`
  - Update `require("./ui/floaty")` → `require("../ui/floaty")` inside the file
  - Update `module.exports` comment from `scroll.js` if present

  **Must NOT do**:
  - Do not change function bodies, parameters, or return values
  - Do not rename exported function names

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file rename + require path update
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 3, 4)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 6 (scanner.js depends on gestures.js)
  - **Blocked By**: Task 1 (lib/ dir must exist)

  **References**:
  - `scroll.js:3` — `var floatyMod = require("./ui/floaty")` must become `require("../ui/floaty")` because the file is now one level deeper

  **Acceptance Criteria**:
  - [ ] `test -f lib/gestures.js` — file exists at new location
  - [ ] `test ! -f scroll.js` — old file gone
  - [ ] `grep 'require.*floaty' lib/gestures.js | grep '\.\./ui/floaty'` — require path correct

  **QA Scenarios**:
  ```
  Scenario: File moved and path updated
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f lib/gestures.js`
      2. `test ! -f scroll.js`
      3. `grep -q 'require.*"\.\./ui/floaty"' lib/gestures.js`
    Expected Result: All 3 steps exit 0
    Evidence: .omo/evidence/task-2-gestures-moved.txt

  Scenario: Exports preserved
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'scrollLeft\|scrollRight\|zoom\|zoomOut\|zoomIn' lib/gestures.js`
    Expected Result: All 5 export names found
    Evidence: .omo/evidence/task-2-exports-preserved.txt
  ```

  **Commit**: YES
  - Message: `refactor: move scroll.js → lib/gestures.js`
  - Files: `R100 scroll.js lib/gestures.js`, `M lib/gestures.js`

---

- [x] 3. Move `detection.js` → `lib/matcher.js` with `findTemplates` rename + `regionFn` injection

  **What to do**:
  - `git mv detection.js lib/matcher.js`
  - Update file header comment
  - Rename `findMushrooms` → `findTemplates` throughout the file (function definition + module.exports)
  - **Critical fix**: Refactor `_resolveRegion()` to accept `regionFn` from options instead of calling `getGameMapRegion` as a global
    - Current (line 57-65):
      ```javascript
      function _resolveRegion() {
        if (typeof getGameMapRegion === "function") {
          var custom = getGameMapRegion();
          if (custom && custom.x !== undefined ...) return custom;
        }
        return _defaultRegion();
      }
      ```
    - New:
      ```javascript
      function _resolveRegion(options) {
        if (options && typeof options.regionFn === "function") {
          var custom = options.regionFn();
          if (custom && custom.x !== undefined ...) return custom;
        }
        return _defaultRegion();
      }
      ```
    - Update the call site inside `findTemplates` (now `findTemplates`) to pass options through:
      ```javascript
      var region = _resolveRegion(options);
      ```
    - Update `findTemplates` signature to accept `options` as third parameter:
      ```javascript
      function findTemplates(screenImage, templates, options) {
      ```
  - Update `require("./ui/config")` → `require("../ui/config")`

  **Must NOT do**:
  - Do NOT rename `nms()`, `loadAllTemplates()`, or `recycleAllTemplates()`
  - Do NOT change function signatures other than `findMushrooms` → `findTemplates(screenImage, templates, options)`
  - Do NOT touch template loading logic or NMS algorithm

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward rename + move with a small refactor. The `regionFn` change is a mechanical parameter injection.
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2, 4)
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 6, 7 (scanner.js and mushroom_finder/main.js both depend on matcher.js)
  - **Blocked By**: Task 1 (lib/ dir must exist)

  **References**:
  - `detection.js:20` — `var config = require("./ui/config")` → `require("../ui/config")`
  - `detection.js:57-65` — `_resolveRegion()` with global `getGameMapRegion` call — must be refactored
  - `detection.js:287` — `function findMushrows(...)` to rename
  - `detection.js:474-479` — module.exports with `findMushrooms` to rename

  **Acceptance Criteria**:
  - [ ] `test -f lib/matcher.js` — file exists at new location
  - [ ] `test ! -f detection.js` — old file gone
  - [ ] `grep -q 'findTemplates' lib/matcher.js` — function renamed
  - [ ] `grep -c 'getGameMapRegion' lib/matcher.js | grep 0` — zero global references remain
  - [ ] `grep -q 'require.*"\.\./ui/config"' lib/matcher.js` — require path correct
  - [ ] `grep -q 'regionFn' lib/matcher.js` — options.regionFn injected

  **QA Scenarios**:
  ```
  Scenario: File moved and functions renamed
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f lib/matcher.js`
      2. `test ! -f detection.js`
      3. `grep -q 'findTemplates' lib/matcher.js`
      4. `grep -q 'findTemplates' lib/matcher.js` to verify export key matches
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-3-matcher-moved.txt

  Scenario: No global getGameMapRegion
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -c 'getGameMapRegion' lib/matcher.js` — must output 0
    Expected Result: Output is 0
    Evidence: .omo/evidence/task-3-no-global-gmgm.txt

  Scenario: regionFn parameter injected
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'regionFn' lib/matcher.js`
      2. `grep -q 'options' lib/matcher.js`
    Expected Result: Both exit 0
    Evidence: .omo/evidence/task-3-regionfn-injected.txt

  Scenario: Exports preserved (with rename)
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'loadAllTemplates\|findTemplates\|nms\|recycleAllTemplates' lib/matcher.js`
    Expected Result: All 4 export names found
    Evidence: .omo/evidence/task-3-exports-preserved.txt
  ```

  **Commit**: YES
  - Message: `refactor: move detection.js → lib/matcher.js, rename findMushrooms → findTemplates, inject regionFn`
  - Files: `R100 detection.js lib/matcher.js`, `M lib/matcher.js`

---

- [x] 4. Split `utils/utils.js` → `lib/screen.js` + `mushroom_finder/screen_state.js`

  **What to do**:
  - Create `lib/screen.js` containing:
    - `saveScreenshotToGallery(image, name?)`
    - `meanBrightness(image)`
    - `terrainRatio(image)`
    - File header: `lib/screen.js — Image capture, brightness, and terrain analysis utilities`
  - Create `mushroom_finder/screen_state.js` containing:
    - `classifyScreenState(image, options?)`
    - `getGameMapRegion(options?)`
    - Import `meanBrightness` and `terrainRatio` from `../lib/screen`:
      ```javascript
      var { meanBrightness, terrainRatio } = require("../lib/screen");
      ```
    - File header: `mushroom_finder/screen_state.js — Pikmin Bloom screen state classification`
  - Delete `utils/utils.js`
  - Remove `utils/` directory (only contained utils.js, now empty)

  **Must NOT do**:
  - Do not change any function logic, thresholds, or return values
  - Do not rename `classifyScreenState`, `getGameMapRegion`, `saveScreenshotToGallery`, `meanBrightness`, or `terrainRatio`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical file split — copy-paste with require path adjustment
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2, 3)
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 5, 6, 7, 8 (scanner.js and main.js depend on screen_state)
  - **Blocked By**: Task 1 (both lib/ and mushroom_finder/ dirs must exist)

  **References**:
  - `utils/utils.js:461-467` — full exports list to split
  - `utils/utils.js` — internal calls: `classifyScreenState` calls `meanBrightness` and `terrainRatio` internally — these must be imported in `screen_state.js`

  **Acceptance Criteria**:
  - [ ] `test -f lib/screen.js` — screen.js created
  - [ ] `test -f mushroom_finder/screen_state.js` — screen_state.js created
  - [ ] `test ! -f utils/utils.js` — old utils.js gone
  - [ ] `test ! -d utils` — utils/ dir removed
  - [ ] `grep -q 'meanBrightness' lib/screen.js` — function in screen.js
  - [ ] `grep -q 'classifyScreenState' mushroom_finder/screen_state.js` — function in screen_state.js
  - [ ] `grep -q 'require.*"\.\./lib/screen"' mushroom_finder/screen_state.js` — import path correct
  - [ ] `grep -q 'saveScreenshotToGallery\|meanBrightness\|terrainRatio' lib/screen.js` — all 3 exports present

  **QA Scenarios**:
  ```
  Scenario: Files created correctly
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f lib/screen.js`
      2. `test -f mushroom_finder/screen_state.js`
      3. `test ! -f utils/utils.js`
      4. `test ! -d utils`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-4-files-created.txt

  Scenario: Exports correct in screen.js
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'saveScreenshotToGallery' lib/screen.js`
      2. `grep -q 'meanBrightness' lib/screen.js`
      3. `grep -q 'terrainRatio' lib/screen.js`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-4-screen-exports.txt

  Scenario: Exports correct in screen_state.js
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'classifyScreenState' mushroom_finder/screen_state.js`
      2. `grep -q 'getGameMapRegion' mushroom_finder/screen_state.js`
    Expected Result: Both exit 0
    Evidence: .omo/evidence/task-4-state-exports.txt

  Scenario: Import path correct in screen_state.js
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'require.*"\.\./lib/screen"' mushroom_finder/screen_state.js`
    Expected Result: Exit 0
    Evidence: .omo/evidence/task-4-import-path.txt
  ```

  **Commit**: YES
  - Message: `refactor: split utils/utils.js → lib/screen.js + mushroom_finder/screen_state.js`
  - Files: `A lib/screen.js`, `A mushroom_finder/screen_state.js`, `D utils/utils.js`, `D utils/`

---

- [x] 5. Move `navigator.js` → `mushroom_finder/01_navigate_to_map.js`

  **What to do**:
  - `git mv navigator.js mushroom_finder/01_navigate_to_map.js`
  - Update file header comment to reflect new name and pipeline phase
  - Update `require("./ui/floaty")` → `require("../ui/floaty")`

  **Must NOT do**:
  - Do not touch `_showTap()` or any navigation state machine logic
  - Do not extract `dismissPikminIcon` or any other function
  - Do not change any function bodies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple move + require path update
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6, 7, 8)
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Task 6 (02_scan_map.js requires 01_navigate_to_map.js)
  - **Blocked By**: Task 1 (mushroom_finder/ dir)

  **References**:
  - `navigator.js:20` — `var floatyMod = require("./ui/floaty")` → `require("../ui/floaty")`

  **Acceptance Criteria**:
  - [ ] `test -f mushroom_finder/01_navigate_to_map.js`
  - [ ] `test ! -f navigator.js`
  - [ ] `grep -q 'require.*"\.\./ui/floaty"' mushroom_finder/01_navigate_to_map.js`
  - [ ] All 5 export names present: `loadNavigationTemplates`, `dismissPikminIcon`, `navigateToMap`, `waitForAndClickLarge`, `waitForAndClickOwnPosition`

  **QA Scenarios**:
  ```
  Scenario: File moved and path updated
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f mushroom_finder/01_navigate_to_map.js`
      2. `test ! -f navigator.js`
      3. `grep -q 'require.*"\.\./ui/floaty"' mushroom_finder/01_navigate_to_map.js`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-5-navigator-moved.txt

  Scenario: All exports preserved
    Tool: Bash
    Preconditions: None
    Steps:
      1. For each name in loadNavigationTemplates|dismissPikminIcon|navigateToMap|waitForAndClickLarge|waitForAndClickOwnPosition, grep
    Expected Result: All 5 found
    Evidence: .omo/evidence/task-5-exports.txt
  ```

  **Commit**: YES
  - Message: `refactor: move navigator.js → mushroom_finder/01_navigate_to_map.js`
  - Files: `R100 navigator.js mushroom_finder/01_navigate_to_map.js`

---

- [x] 6. Move `scanner.js` → `mushroom_finder/02_scan_map.js`

  **What to do**:
  - `git mv scanner.js mushroom_finder/02_scan_map.js`
  - Update file header comment to reflect new name and pipeline phase
  - Update all require paths:
    - `require("./detection")` → `require("../lib/matcher")`
    - `require("./ui/floaty")` → `require("../ui/floaty")`
    - `require("./scroll")` → `require("../lib/gestures")`
    - `require("./navigator")` → `require("./01_navigate_to_map")` (same dir, new filename)

  **Must NOT do**:
  - Do not touch the scan loop logic, direction flip, settle delay, or empty scroll handling
  - Do not change volume key handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Move + mechanical require path updates
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 7, 8)
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Task 8 (mushroom_finder/main.js depends on 02_scan_map.js)
  - **Blocked By**: Tasks 2, 3, 4 (needs lib/ files to exist), Task 5 (needs 01_navigate_to_map.js in mushroom_finder/)

  **References**:
  - `scanner.js:22-25` — current require statements
  - Target paths: `../lib/matcher`, `../ui/floaty`, `../lib/gestures`, `./01_navigate_to_map`

  **Acceptance Criteria**:
  - [ ] `test -f mushroom_finder/02_scan_map.js`
  - [ ] `test ! -f scanner.js`
  - [ ] `grep -q 'require.*"\.\./lib/matcher"' mushroom_finder/02_scan_map.js`
  - [ ] `grep -q 'require.*"\.\./ui/floaty"' mushroom_finder/02_scan_map.js`
  - [ ] `grep -q 'require.*"\.\./lib/gestures"' mushroom_finder/02_scan_map.js`
  - [ ] `grep -q 'require.*"\.\/01_navigate_to_map"' mushroom_finder/02_scan_map.js`

  **QA Scenarios**:
  ```
  Scenario: File moved and paths updated
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f mushroom_finder/02_scan_map.js`
      2. `test ! -f scanner.js`
      3. `grep -q '\.\./lib/matcher' mushroom_finder/02_scan_map.js`
      4. `grep -q '\.\./ui/floaty' mushroom_finder/02_scan_map.js`
      5. `grep -q '\.\./lib/gestures' mushroom_finder/02_scan_map.js`
      6. `grep -q '\./01_navigate_to_map' mushroom_finder/02_scan_map.js`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-6-scanner-moved.txt
  ```

  **Commit**: YES
  - Message: `refactor: move scanner.js → mushroom_finder/02_scan_map.js`
  - Files: `R100 scanner.js mushroom_finder/02_scan_map.js`

---

- [x] 7. Create `mushroom_finder/03_handle_mushroom.js` — mushroom result handler

  **What to do**:
  - Create `mushroom_finder/03_handle_mushroom.js` with a single exported function:
    ```javascript
    /**
     * 03_handle_mushroom.js — Handle a found mushroom result.
     *
     * Called by main.js when the scan loop detects a match.
     * Takes a screenshot, saves it, toasts the result, and exits.
     */
    module.exports = {
      handleMushroomFound: handleMushroomFound
    };
    ```
  - Extract the `onFound` callback logic from root `main.js` into this file. The current logic (approximately):
    ```javascript
    function handleMushroomFound(panel, match, config) {
      floatyMod.updateStatus(panel, "Large Mushroom Found!");
      floatyMod.appendLog(panel, "Found \"" + match.templateName + "\" at (" + ... + ")");
      sleep(1000);
      var capture = captureScreen();
      var screenshotPath = utils.saveScreenshotToGallery(capture, match.templateName);
      toast("Found: " + match.templateName + " at " + screenshotPath);
      floatyMod.showDuringScan(panel, true);
      sleep(3000);
      floatyMod.destroy(panel);
      engines.myEngine().forceStop();
    }
    ```
  - Update requires:
    - `require("./ui/floaty")` → `require("../ui/floaty")`
    - `require("./utils/utils")` (for `saveScreenshotToGallery`) → `require("../lib/screen")`
    - `captureScreen()` is a global AutoJS6 API — no import needed

  **Must NOT do**:
  - Do not add any new behavior or side effects
  - Do not change how the screenshot is saved, how the toast is shown, or the exit flow
  - Do not include volume key handling or singleton guard logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple extraction of the onFound callback into its own file
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6, 8)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 8 (main.js orchestrator calls handleMushroomFound)
  - **Blocked By**: Task 1 (mushroom_finder/ dir must exist)

  **References**:
  - `main.js:140-150` — current onFound callback passed to startScanning
  - `main.js:20-26` — current requires for floatyMod and utils

  **Acceptance Criteria**:
  - [ ] `test -f mushroom_finder/03_handle_mushroom.js`
  - [ ] `grep -q 'handleMushroomFound' mushroom_finder/03_handle_mushroom.js`
  - [ ] `grep -q 'module.exports' mushroom_finder/03_handle_mushroom.js`
  - [ ] `grep -q 'saveScreenshotToGallery' mushroom_finder/03_handle_mushroom.js` — uses screenshot saving
  - [ ] `grep -q 'require.*"\.\./ui/floaty"' mushroom_finder/03_handle_mushroom.js`
  - [ ] `grep -q 'require.*"\.\./lib/screen"' mushroom_finder/03_handle_mushroom.js`

  **QA Scenarios**:
  ```
  Scenario: File created with correct exports
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f mushroom_finder/03_handle_mushroom.js`
      2. `grep -q 'handleMushroomFound' mushroom_finder/03_handle_mushroom.js`
      3. `grep -q 'module.exports' mushroom_finder/03_handle_mushroom.js`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-7-handler-created.txt

  Scenario: Require paths correct
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q '\.\./ui/floaty' mushroom_finder/03_handle_mushroom.js`
      2. `grep -q '\.\./lib/screen' mushroom_finder/03_handle_mushroom.js`
    Expected Result: Both exit 0
    Evidence: .omo/evidence/task-7-require-paths.txt
  ```

  **Commit**: YES
  - Message: `refactor: extract onFound handler into mushroom_finder/03_handle_mushroom.js`
  - Files: `A mushroom_finder/03_handle_mushroom.js`

---

- [x] 8. Create `mushroom_finder/main.js` — pipeline orchestrator (calls 01→02→03)

  **What to do**:
  - Create `mushroom_finder/main.js` that exports a `run(settings)` function
  - The orchestrator calls the pipeline phases in order:
    1. `require("./01_navigate_to_map")` — navigate to the mushroom map
    2. Create floaty panel via `require("../ui/floaty")`
    3. `require("./02_scan_map")` — start scan loop
    4. **onFound callback**: calls `require("./03_handle_mushroom").handleMushroomFound(panel, match, config)`
  - Include all the pipeline logic from the current `main.js` (phases 1-4):
    - Load templates (`require("../lib/matcher").loadAllTemplates`)
    - Create floaty panel
    - Navigate to map
    - Start scan loop with onFound delegating to 03_handle_mushroom
    - Handle scan stop signals
  - Update all require paths (relative to mushroom_finder/):
    - `../ui/config`
    - `../lib/screen` (for saveScreenshotToGallery — used in onFound callback before extraction)
    - `../lib/matcher` (for loadAllTemplates, findTemplates)
    - `./01_navigate_to_map`
    - `./02_scan_map`
    - `./03_handle_mushroom`
    - `../ui/floaty`
  - Use `matcher.findTemplates()` (renamed from `findMushrooms`) in the detection call
  - The onFound callback should now delegate to `03_handle_mushroom.handleMushroomFound(panel, match, config)` instead of doing screenshot+toast+exit inline

  **Must NOT do**:
  - Do not change pipeline logic, timing, or behavior
  - Do not remove the volume key listener setup
  - Do not change how scan stop is handled
  - Do not leave any pipeline logic in root main.js

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires extracting pipeline code and reorganizing it to call the numbered phase modules. The most complex refactoring task — need to understand the full flow and split it correctly across 01→02→03.
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6, 7)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 9 (root main.js rewritten after mushroom_finder/main.js exists)
  - **Blocked By**: Tasks 2, 3, 4 (needs lib/ files), Tasks 5, 6, 7 (needs 01_, 02_, 03_ files)

  **References**:
  - `main.js:18-289` — full pipeline to extract
  - `main.js:20-26` — current require statements
  - `main.js:133-137` — createControlPanel + destroy
  - `main.js:138-284` — pipeline phases 1-4

  **Acceptance Criteria**:
  - [ ] `test -f mushroom_finder/main.js`
  - [ ] `grep -q 'module.exports' mushroom_finder/main.js`
  - [ ] `grep -q 'run' mushroom_finder/main.js` — exports run() function
  - [ ] `grep -q 'require.*"\.\/01_navigate_to_map"' mushroom_finder/main.js` — calls phase 1
  - [ ] `grep -q 'require.*"\.\/02_scan_map"' mushroom_finder/main.js` — calls phase 2
  - [ ] `grep -q 'require.*"\.\/03_handle_mushroom"' mushroom_finder/main.js` — calls phase 3
  - [ ] `grep -q 'findTemplates' mushroom_finder/main.js` — uses renamed function
  - [ ] All require paths point to correct locations

  **QA Scenarios**:
  ```
  Scenario: File created with run() export and phase calls
    Tool: Bash
    Preconditions: None
    Steps:
      1. `test -f mushroom_finder/main.js`
      2. `grep -q 'module.exports' mushroom_finder/main.js`
      3. `grep -q 'run' mushroom_finder/main.js`
      4. `grep -q '01_navigate_to_map' mushroom_finder/main.js`
      5. `grep -q '02_scan_map' mushroom_finder/main.js`
      6. `grep -q '03_handle_mushroom' mushroom_finder/main.js`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-8-main-created.txt

  Scenario: All require paths resolve
    Tool: Bash
    Preconditions: None
    Steps:
      1. For each require() in mushroom_finder/main.js, verify the resolved target exists
    Expected Result: All paths resolve
    Evidence: .omo/evidence/task-8-require-paths.txt
  ```

  **Commit**: YES
  - Message: `refactor: create mushroom_finder/main.js orchestrator (01→02→03)`
  - Files: `A mushroom_finder/main.js`

---

- [x] 9. Rewrite root `main.js` as ultra-thin dispatcher

  **What to do**:
  - Replace the entire content of root `main.js` with a thin dispatcher:
    ```javascript
    "auto";

    /**
     * main.js — Entry point for the AutoJS6 Pikmin Bloom Mushroom Finder.
     *
     * Ultra-thin dispatcher: shows config dialog, then delegates
     * to the domain-specific module.
     */

    var configUi = require("./ui/config_ui");

    // ── Singleton guard ──────────────────────────────────────────────
    var thisEngine = engines.myEngine();
    engines.all().forEach(function(engine) {
      if (engine.id !== thisEngine.id) {
        engine.forceStop();
      }
    });

    // ── Show config dialog, then dispatch ────────────────────────────
    var settings = configUi.showConfigDialog();
    if (settings) {
      require("./mushroom_finder/main").run(settings);
    }
    ```
  - Keep the singleton guard (`engines.myEngine().id` loop) in this file
  - Keep `"auto";` directive

  **Must NOT do**:
  - Do not keep any pipeline logic in root main.js
  - Do not add any new code beyond the dispatcher pattern shown above
  - Do not remove the singleton guard

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple rewrite to thin dispatcher
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10)
  - **Parallel Group**: Wave 3 (with Tasks 9, 10)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 8 (needs mushroom_finder/main.js to exist)

  **References**:
  - Current `main.js:44-50` — singleton guard to preserve
  - `main.js:18` — `"auto"` directive to preserve
  - The config dialog call pattern from current `main.js` (lines around configUi usage)

  **Acceptance Criteria**:
  - [ ] `node --check main.js` — syntax check passes (note: AutoJS6 uses rhino engine, but node syntax check catches most issues)
  - [ ] `grep -q 'engines.myEngine' main.js` — singleton guard preserved
  - [ ] `grep -q 'require.*"\./mushroom_finder/main"' main.js` — dispatches correctly
  - [ ] `grep -c 'function ' main.js | grep 0` — no function definitions (ultra-thin)

  **QA Scenarios**:
  ```
  Scenario: Syntax check passes
    Tool: Bash
    Preconditions: None
    Steps:
      1. `node --check main.js`
    Expected Result: Exit 0, no syntax errors
    Evidence: .omo/evidence/task-9-syntax-check.txt

  Scenario: Dispatcher pattern correct
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'engines.myEngine' main.js`
      2. `grep -q 'configUi.showConfigDialog' main.js`
      3. `grep -q 'mushroom_finder/main' main.js`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-9-dispatcher-pattern.txt

  Scenario: No pipeline logic remains
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -c 'loadTemplates\|startScanning\|navigateToMap' main.js`
    Expected Result: Count is 0
    Evidence: .omo/evidence/task-9-no-pipeline.txt
  ```

  **Commit**: YES
  - Message: `refactor: rewrite root main.js as thin dispatcher`
  - Files: `M main.js`

---

- [x] 10. Delete old root files + `utils/` directory

  **What to do**:
  - For each file that was moved but not yet deleted (some may have been auto-deleted by `git mv`):
    - `git rm` any remaining old root files: detection.js, navigator.js, scanner.js, scroll.js (if they still exist — git mv should have handled this but verify)
    - `git rm utils/utils.js` if it wasn't already handled in Task 4
    - `rmdir utils/` if empty
  - Verify no stale files remain

  **Important**: `git mv` already removes the old file from the working tree, so this task may be a no-op for most files. The goal is to verify and clean up anything left behind (especially `utils/` directory).

  **Must NOT do**:
  - Do not delete `main.js`, `README.md`, `project.json`, `templates/`, `node_modules/`, or any `.git*` files
  - Do not delete files in `ui/`, `lib/`, or `mushroom_finder/`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file cleanup with verification
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 11)
  - **Parallel Group**: Wave 3 (with Tasks 9, 11)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2-7 (moves must be done first to know what to clean up)

  **References**: None — purely verification + cleanup

  **Acceptance Criteria**:
  - [ ] `test ! -f detection.js` — detection.js deleted
  - [ ] `test ! -f navigator.js` — navigator.js deleted
  - [ ] `test ! -f scanner.js` — scanner.js deleted
  - [ ] `test ! -f scroll.js` — scroll.js deleted
  - [ ] `test ! -f utils/utils.js` — utils.js deleted
  - [ ] `test ! -d utils` — utils/ directory removed

  **QA Scenarios**:
  ```
  Scenario: No stale files remain at root
    Tool: Bash
    Preconditions: None
    Steps:
      1. `for f in detection.js navigator.js scanner.js scroll.js; do test ! -f "$f" || exit 1; done`
      2. `test ! -d utils`
    Expected Result: Exit 0
    Evidence: .omo/evidence/task-10-clean-root.txt

  Scenario: Only expected root files exist
    Tool: Bash
    Preconditions: None
    Steps:
      1. `ls *.js` — should show only main.js and possibly project config files
    Expected Result: Just main.js (plus project.json, README.md, templates/ etc.)
    Evidence: .omo/evidence/task-10-root-files.txt
  ```

  **Commit**: YES (if any deletions needed)
  - Message: `refactor: delete stale root files and utils/ directory`
  - Files: Any deletions found

---

- [x] 11. Update `README.md` project structure tree

  **What to do**:
  - Replace the current project structure tree in README.md with the new structure:
    ```
    autojs/
    ├── main.js                 Entry point — ultra-thin dispatcher
    ├── lib/                    Reusable AutoJS6 utilities
    │   ├── gestures.js         Scroll, zoom, swipe helpers
    │   ├── matcher.js          Multi-template matching engine (findImage + NMS)
    │   └── screen.js           Screenshot capture, brightness analysis
    ├── ui/                     UI components
    │   ├── config.js           Centralized configuration values
    │   ├── config_ui.js        Pre-flight settings dialog
    │   └── floaty.js           Floating log panel
    ├── mushroom_finder/        Mushroom hunting domain logic
    │   ├── main.js             Pipeline orchestrator (calls 01→02→03)
    │   ├── 01_navigate_to_map  Navigate to mushroom map (phase 1)
    │   ├── 02_scan_map         Scan loop — zigzag + capture + detect (phase 2)
    │   ├── 03_handle_mushroom  Handle found mushroom (phase 3)
    │   └── screen_state.js     Screen state classification (Pikmin Bloom-specific)
    ├── templates/
    │   ├── navigation/
    │   └── mushrooms/
    └── README.md
    ```
  - Also update any path references in the README text (e.g., if it mentions `config.js`, `floaty.js`, etc.)

  **Must NOT do**:
  - Do not rewrite or improve any other README content
  - Do not change descriptions, usage instructions, or configuration docs

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple tree replacement + path reference updates
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 9, 10)
  - **Parallel Group**: Wave 3 (with Tasks 9, 10)
  - **Blocks**: F1-F4
  - **Blocked By**: None (can be done any time, but best after files are actually moved)

  **References**: None

  **Acceptance Criteria**:
  - [ ] `grep -q 'lib/gestures.js' README.md` — new structure reflected
  - [ ] `grep -q 'mushroom_finder/' README.md` — new directory mentioned
  - [ ] `grep -q '01_navigate_to_map' README.md` — numbered phases visible
  - [ ] `grep -q '02_scan_map' README.md`
  - [ ] `grep -q '03_handle_mushroom' README.md`
  - [ ] `grep -q 'screen_state' README.md`
  - [ ] `grep -c 'utils.js' README.md | grep 0` — utils.js removed from tree
  - [ ] `grep -c 'config.js' README.md | grep -v 0` — config.js still in tree (under ui/)

  **QA Scenarios**:
  ```
  Scenario: New structure reflected
    Tool: Bash
    Preconditions: None
    Steps:
      1. `grep -q 'lib/gestures' README.md`
      2. `grep -q 'mushroom_finder/' README.md`
      3. `grep -q 'lib/matcher' README.md`
      4. `grep -q '01_navigate_to_map' README.md`
      5. `grep -q 'screen_state' README.md`
    Expected Result: All exit 0
    Evidence: .omo/evidence/task-11-readme-updated.txt

  Scenario: Old references removed
    Tool: Bash
    Preconditions: None
    Steps:
      1. `! grep -q 'utils.js' README.md` — unless it appears in other sections legitimately
    Expected Result: Exit 0 (or 1 if utils.js still appears outside the tree)
    Evidence: .omo/evidence/task-11-readme-old-refs.txt
  ```

  **Commit**: YES
  - Message: `docs: update README project structure`
  - Files: `M README.md`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (grep exports, check file existence). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **File Structure & Path Audit** — `unspecified-high`
  Verify the exact file tree matches the planned structure using `find . -name '*.js' -not -path './node_modules/*' | sort`. Check every `require()` path resolves to an existing file. Verify all old root files deleted. Check README tree matches actual tree.
  Output: `File tree [PASS/FAIL] | Require paths [N/N resolve] | Old files [N deleted] | README [MATCH/MISMATCH] | VERDICT`

- [x] F3. **Export/Function Integrity Check** — `deep`
  For each function in the old `module.exports` (from pre-refactor files), verify it exists in the corresponding new file's `module.exports`. Check that `findMushrooms` was renamed to `findTemplates`. Verify `lib/matcher.js` has zero references to global `getGameMapRegion` and uses the new `regionFn` pattern.
  Output: `Functions [N/N preserved] | Renames [findMushrooms→findTemplates OK] | Globals [CLEAN/ISSUES] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was done (no missing), nothing beyond spec was done (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Task 1**: `chore: create lib/ and mushroom_finder/ directories` (with .gitkeep)
- **Task 2**: `refactor: move scroll.js → lib/gestures.js`
- **Task 3**: `refactor: move detection.js → lib/matcher.js, rename findMushrooms → findTemplates, inject regionFn`
- **Task 4**: `refactor: split utils/utils.js → lib/screen.js + mushroom_finder/screen_state.js`
- **Task 5**: `refactor: move navigator.js → mushroom_finder/01_navigate_to_map.js`
- **Task 6**: `refactor: move scanner.js → mushroom_finder/02_scan_map.js`
- **Task 7**: `refactor: extract onFound handler into mushroom_finder/03_handle_mushroom.js`
- **Task 8**: `refactor: create mushroom_finder/main.js orchestrator (01→02→03)`
- **Task 9**: `refactor: rewrite root main.js as thin dispatcher`
- **Task 10**: `refactor: delete stale root files and utils/ directory` (if needed)
- **Task 11**: `docs: update README project structure`

---


## Success Criteria

### Verification Commands
```bash
# No old require paths remain
! grep -rn 'require("\..*detection")' --include="*.js" . | grep -v node_modules
! grep -rn 'require("\..*scroll")' --include="*.js" . | grep -v node_modules

# No old root files exist
test ! -f detection.js && test ! -f navigator.js && test ! -f scanner.js && test ! -f scroll.js

# No global getGameMapRegion in lib/matcher.js
! grep 'getGameMapRegion' lib/matcher.js

# All new files have correct exports
grep 'module.exports' lib/gestures.js lib/matcher.js lib/screen.js mushroom_finder/screen_state.js mushroom_finder/01_navigate_to_map.js mushroom_finder/02_scan_map.js mushroom_finder/03_handle_mushroom.js mushroom_finder/main.js

# Root main.js syntax check
node --check main.js
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All verification commands pass
