# Pikmin Bloom — Mushroom Finder Script (v1)

## TL;DR

> **Quick Summary**: Build a modular AutoJs6 script that auto-launches Pikmin Bloom, validates the map screen, scrolls (swipe-drag) in a vertical zigzag pattern searching for large mushrooms via multi-template matching (~12 mushroom types), saves a screenshot to the device gallery when found, and continues searching indefinitely until the user manually stops.
>
> **Deliverables**:
> - Modular AutoJs6 script: `main.js`, `config.js`, `utils.js`, `detection.js`, `scanner.js`, `floaty.js`
> - Updated `project.json`
> - Floating window UI framework for future feature toggles
> - Multi-template image placement guide (~12 mushroom type PNGs in a single templates directory)
> - Graceful volume-key shutdown mechanism
>
> **Estimated Effort**: Medium (~6 files, moderate complexity)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Config + Utils → Detection → Scanner → Main integration

---

## Context

### Original Request
> "I want to start a new project in this folder, I want to automate game Pikmin Bloom using AutoJS, I want this script to help me find mushroom, so basically keep scrolling, until map shows large mushroom."

### Interview Summary
**Key Discussions**:
- **Found action**: Save screenshot to device gallery and stop. Tapping the mushroom is deferred to future.
- **Search behavior**: Never stop searching until mushroom is found (manually stopped via volume keys).
- **Scrolling**: Vertical zigzag drag pattern (v1). Radial spiral deferred to future.
- **Screen resolution**: Dynamic — use `device.width` / `device.height` at runtime.
- **AutoJS fork**: AutoJs6 (SuperMonster003) v6.7.0+ on Android 14.
- **Floating dialog**: `floaty.rawWindow()` with `setTouchable(false)` — framework for future options.
- **Template**: User will provide cropped PNG images for all ~12 large mushroom types, placed in a single template directory. Each MUST be from same device at same zoom level.

**Research Findings**:
- Reference project at `/home/henry/code/game/autojs-mushroom-hunter/autojs/` provides patterns for: `detection.js` (template matching + NMS), `utils.js` (screen state classification via pixel sampling), `scanner.js` (chunked-wait interrupt pattern), `config.js` (key-value parser).
- AutoJs6 `floaty.rawWindow()` supports `setTouchable(false)` for touch pass-through (critical — prevents floaty from absorbing swipe gestures).
- `captureScreen()` on Android 14 requires proper foreground service (supported in AutoJs6 v6.6.x+ via PR #242).
- `images.findImage()` (OpenCV template matching) is NOT scale/rotation invariant — template must match device resolution and zoom level exactly.
- `events.observeKey()` must be called BEFORE `onKeyDown()` listeners for volume key shutdown to work.
- Every `captureScreen()` call must be paired with `.recycle()` in `try/finally` to prevent OOM.

### Metis Review
**Identified Gaps** (addressed):
- AutoJs6 fork compatibility confirmed (v6.7.0+ with string XML fix)
- Floaty touch absorption risk mitigated via `setTouchable(false)` + auto-hide during scanning
- Template scale mismatch risk documented (all ~12 templates must be from same device at same zoom level)
- Indefinite search loop with volume-key shutdown as the only stop mechanism
- `try/finally` wrap required around all capture→detect→recycle chains

---

## Work Objectives

### Core Objective
Build a modular, maintainable AutoJs6 script that autonomously searches Pikmin Bloom's game map for large mushrooms and alerts the user when one is found — designed to be extended with more features (continuous mode, auto-tap, etc.) in future versions.

### Concrete Deliverables
- `/home/henry/code/autojs/project.json` — Updated with real name and metadata
- `/home/henry/code/autojs/main.js` — Entry point: orchestrates launch → validate → scan loop
- `/home/henry/code/autojs/config.js` — All user-tunable parameters
- `/home/henry/code/autojs/utils.js` — Screen state classification, ROI calculation, image utilities
- `/home/henry/code/autojs/detection.js` — Template matching engine with NMS deduplication
- `/home/henry/code/autojs/scanner.js` — Scan loop: scroll → capture → detect → cycle logic
- `/home/henry/code/autojs/floaty.js` — Floating window UI (status display framework)

### Definition of Done
- [ ] Script launches on device via AutoJs6
- [ ] App auto-launches Pikmin Bloom and reaches map screen
- [ ] Screen validates as "map_visible" before scanning begins
- [ ] Script scrolls in vertical zigzag pattern (sweeps left, shift down, repeat)
- [ ] Each scroll cycle: swipe → settle → capture → detect
- [ ] When ANY of ~12 large mushroom types detected: screenshot saved to device gallery, script stops
- [ ] Volume key (single press) sets shutdown flag (graceful stop after current cycle)
- [ ] Volume key (double press) force-stops immediately
- [ ] Floating window shows current status (searching / mushroom found / stopped)
- [ ] No OOM crash after 100+ scroll cycles (images properly recycled)

### Must Have
- Auto-launch Pikmin Bloom via `app.launchPackage("com.nianticlabs.pikmin")`
- Screen state validation (loading / map_visible / error) before scan starts
- Vertical zigzag scroll pattern (left sweeps → shift down → left sweeps)
- Multi-template matching: load ALL .png templates from a directory (~12 types); iterate and break on first match
- Screenshot saved to device gallery on detection
- Floating window UI (`floaty.rawWindow()` with `setTouchable(false)`)
- Graceful shutdown via volume keys (single = graceful, double = force)
- Indefinite search (no hard stop limit — runs until found or manually stopped)
- All coordinates computed from `device.width` / `device.height` (no hardcoded pixels)
- All `captureScreen()` calls wrapped in `try/finally` with `.recycle()`

### Must NOT Have (Guardrails)
- No GPS spoofing or teleport (explicitly future)
- No auto-tap on found mushroom (explicitly future)
- No continuous/keep-searching toggle in v1 (explicitly future)
- No radial spiral scroll pattern (explicitly future)
- No multiple mushroom type detection (explicitly future)
- No `console.show()` simultaneously with floaty (overlay conflict)
- No `swipe()` with duration > 2000ms (blocks interrupt handling)
- No hardcoded pixel values — all dimensions from `device.width/height`
- No double-recycle of Image objects

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
>
> **Note**: Since this is a physical Android device script, verification is inherently device-bound. Where possible, verification uses device commands (adb) or offline test scripts against pre-captured screenshots.

### Test Decision
- **Infrastructure exists**: NO (AutoJs6 on-device — no unit test framework)
- **Automated tests**: None (manual device testing)
- **Verification method**: Offline test harness (`test_scan.js`) uses pre-captured test screenshots to validate detection and screen classification WITHOUT live game

### QA Policy
Every task MUST include agent-executable verification steps. Evidence where possible:
- **Module logic test**: `node` or `adb shell` with AutoJs6 test script
- **Template match test**: Use `images.findImage()` against pre-captured test screenshots with known mushroom positions
- **Screen classification test**: Provide sample images for each state (loading, map_visible, error) and verify classification
- **Coordinate computation test**: Verify swipe points are within screen bounds given mock `device.width/height`
- **Memory leak test**: Simulate 50 capture→detect cycles, verify no OOM

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — independent, MAX PARALLEL):
├── Task 1: Project scaffolding (project.json + directory structure) [quick]
├── Task 2: config.js — all user-tunable parameters [quick]
├── Task 3: utils.js — screen classification, ROI, image utilities [unspecified-high]
├── Task 4: detection.js — multi-template matching + NMS (~12 mushroom types) [unspecified-high]
└── Task 5: floaty.js — floating window UI framework [unspecified-high]

Wave 2 (Core Logic — depends on utils + detection):
├── Task 6: scanner.js — scan loop with zigzag scroll, capture→detect cycle [deep]
└── Task 7: main.js — entry point orchestrating everything [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA on device (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Tasks 2-5 (parallel) → Task 6 → Task 7 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 (scaffold) | None | 2-5 |
| 2 (config) | None | 6, 7 |
| 3 (utils) | None | 6, 7 |
| 4 (detection) | None | 6, 7 |
| 5 (floaty) | None | 7 |
| 6 (scanner) | 2, 3, 4 | 7 |
| 7 (main) | 2, 3, 4, 5, 6 | F1-F4 |
| F1-F4 | 7 | user okay |

### Agent Dispatch Summary

- **Wave 1**: 5 parallel — T1 → `quick`, T2 → `quick`, T3 → `unspecified-high`, T4 → `unspecified-high`, T5 → `unspecified-high`
- **Wave 2**: 2 sequential — T6 → `deep`, T7 → `unspecified-high`
- **Wave FINAL**: 4 parallel — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. **Project Scaffolding**

  **What to do**:
  - Update `project.json` with project name, description, author, main entry point
  - Create the script module files as stubs (each file gets a `module.exports = {}` skeleton):
    - `config.js`, `utils.js`, `detection.js`, `scanner.js`, `floaty.js`, `main.js`
  - Create a `templates/` directory reference path in config (actual .png files will be provided by user)
  - Ensure all files start with correct AutoJs6 engine directives
  - Set `"name": "Pikmin Bloom Mushroom Finder"`, `"main": "main.js"`, `"packageName": "com.example.pikminfinder"`, `"versionName": "1.0.0"`, `"versionCode": 1`

  **Must NOT do**:
  - Don't add `"ui"` directive unless explicitly needed (floaty module doesn't require it)
  - Don't create template .png files (user provides them)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none
  - **Reason**: Simple file creation and JSON editing — no complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: Tasks 6 (scanner) and 7 (main)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `/home/henry/code/autojs/project.json` — Current config to update
  - `/home/henry/code/autojs/.omo/drafts/pikmin-bloom-mushroom-finder.md` — Requirements draft
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/` — Reference module structure

  **Acceptance Criteria**:
  - [ ] `project.json` updated with proper metadata
  - [ ] All 6 stub `.js` files created with `module.exports = {}`
  - [ ] Each stub has a clear JSDoc comment describing its purpose
  - [ ] `main.js` has correct top-level structure for AutoJs6

  **QA Scenarios**:
  ```
  Scenario: Verify file structure
    Tool: Bash
    Preconditions: Files written to /home/henry/code/autojs/
    Steps:
      1. ls -la /home/henry/code/autojs/*.js
      2. Check that all 6 .js files exist
      3. cat project.json — verify name, main, packageName
    Expected Result: 6 .js files exist, project.json has correct fields
    Evidence: .omo/evidence/task-1-file-structure.txt
  ```

  **Commit**: YES
  - Message: `chore: scaffold AutoJs6 mushroom finder project structure`
  - Files: `project.json`, `config.js`, `utils.js`, `detection.js`, `scanner.js`, `floaty.js`, `main.js`

- [x] 2. **config.js — Configuration Module**

  **What to do**:
  - Create a centralized configuration object with ALL user-tunable parameters:
    - `app.packageName`: `"com.nianticlabs.pikmin"` (configurable fallback)
    - `app.launchTimeout`: 30000 (ms to wait for app to launch)
    - `app.mapTransitionTimeout`: 15000 (ms to wait for map screen after launch)
    - `scan.settleDelay`: 1000 (ms to wait after swipe for map inertia to settle)
    - `scan.swipeDuration`: 600 (ms per swipe gesture — keep under 2000)
    - `scan.overlapPercent`: 0.4 (40% overlap between scroll rows)
    - `scan.verticalShiftPercent`: 0.6 (shift 60% of screen height per row)
    - `detection.threshold`: 0.85 (template match confidence 0-1)
    - `detection.maxMatches`: 5 (max matches per template from NMS)
    - `detection.nmsOverlap`: 0.3 (IoU threshold for NMS dedup)
    - `detection.breakOnFirstMatch`: true (stop trying more templates once ANY match found — saves CPU)
    - `detection.templateDir`: `"/sdcard/autojs/templates/"` (directory containing all template .png files)
    - `detection.templatePattern`: `"*.png"` (glob pattern to find template files in the directory)
    - `ui.statusBarHeight`: 50 (pixels to skip at top for status bar)
    - `ui.navBarHeight`: 60 (pixels to skip at bottom for nav bar)
    - `screenshot.outputDir`: `"/sdcard/DCIM/PikminMushroomFinder/"`
    - `debug.enabled`: false (verbose logging)
    - `debug.logToFloaty`: true (show status in floaty window)
  - Add JSDoc comments for each config group explaining what it controls
  - Export via `module.exports = config`

  **Must NOT do**:
  - Don't hardcode any values in other modules — all tunable params go here
  - Don't use `setScreenMetrics()` for coordinate scaling (confirmed not to work for swipe)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Pure data file — no logic, just well-organized config object

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: Tasks 6 (scanner) and 7 (main)
  - **Blocked By**: None

  **References**:
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/config.js` — Reference config loader pattern
  - `/home/henry/code/game/autojs-mushroom-hunter/config.txt` — Key-value config file format

  **Acceptance Criteria**:
  - [ ] All parameters listed above are present with documented defaults
  - [ ] `detection.templateDir` replaces the old single `template.path` — directory-based, not file-based
  - [ ] `detection.breakOnFirstMatch` included (default: true) for performance optimization
  - [ ] Each parameter has a JSDoc comment explaining its purpose and units
  - [ ] `module.exports = config` is present
  - [ ] Config can be `require()`-ed without errors in AutoJs6 runtime

  **QA Scenarios**:
  ```
  Scenario: Config loads without errors
    Tool: Bash
    Preconditions: config.js written to disk
    Steps:
      1. node -e "var c = require('./config.js'); console.log(JSON.stringify(c, null, 2))"
      (OR on device: adb shell am broadcast -n ... with AutoJs6 test)
      2. Verify all expected keys are present
    Expected Result: Config object loads with all keys, no syntax errors
    Evidence: .omo/evidence/task-2-config-load.txt
  ```

  **Commit**: YES (with Task 1)
  - Message: `feat: add configuration module with all tunable parameters`

- [x] 3. **utils.js — Utility Functions**

  **What to do**:
  - Implement screen state classification (pixel sampling with stride):
    - `classifyScreenState(image)` → Returns `"loading" | "map_visible" | "error" | "unknown"`
    - Check 1: Mean brightness < 50 → `"loading"` (dark screen)
    - Check 2: Green/blue terrain pixel ratio > 0.15 → `"map_visible"`
    - Check 3: High contrast error dialog region → `"error"`
    - Sample every 10th pixel (stride) for performance
    - Log classification stats in debug mode
  - Implement ROI (region of interest) calculation:
    - `getGameMapRegion()` → Returns `{x, y, w, h}` excluding status bar and nav bar
    - Use `device.width` and `device.height` for dynamic calculation (NO hardcoded values)
    - Configurable margins from config.js (statusBarHeight, navBarHeight)
  - Implement screenshot save utility:
    - `saveScreenshotToGallery(image, filename)` → Saves using `images.save()` then triggers MediaScanner to make it visible in gallery
    - Generate timestamp-based filenames: `mushroom_found_YYYYMMDD_HHmmss.png`
  - Implement `meanBrightness(image)` — average pixel luminance across sampled pixels
  - Implement `terrainRatio(image)` — proportion of pixels matching terrain color profile
  - All threshold constants should reference config.js values (with fallback defaults)
  - Export via `module.exports = { classifyScreenState, getGameMapRegion, saveScreenshotToGallery, meanBrightness, terrainRatio }`

  **Must NOT do**:
  - Don't hardcode pixel thresholds (brightness < 50, terrain ratio > 0.15) — read from config with fallback
  - Don't use `device.width` or `device.height` as literals — use the runtime values
  - Don't implement screen capture here (that's in scanner.js)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Moderate complexity — pixel sampling math, striding for performance, multiple classification heuristics

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: Tasks 6 (scanner) and 7 (main)
  - **Blocked By**: None (imports config.js but the module is simple enough to inline defaults)

  **References**:
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/utils.js:223-270` — Reference screen state classification with stride-based pixel sampling
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/utils.js:71` — Reference ROI region calculation
  - `https://ys1231.github.io/AutoJs6/image.html` — AutoJs6 images API docs (capture, save, pixel operations)

  **Acceptance Criteria**:
  - [ ] `classifyScreenState()` implemented with all 4 return values
  - [ ] Pixel stride sampling (every 10th pixel) for performance
  - [ ] `getGameMapRegion()` returns correct region using `device.width/height`
  - [ ] `saveScreenshotToGallery()` generates dated filenames and triggers MediaScanner
  - [ ] All thresholds have fallback defaults if config value not provided
  - [ ] Module exports all 5 functions

  **QA Scenarios**:
  ```
  Scenario: ROI region is dynamic based on device dimensions
    Tool: Bash
    Preconditions: utils.js written
    Steps:
      1. Create test with mock device.width=1080, device.height=2400
      2. Call getGameMapRegion()
      3. Assert region.w === 1080, region.h === 2290 (2400 - 50 - 60)
    Expected Result: Region correctly excludes status bar and nav bar
    Evidence: .omo/evidence/task-3-roi-region.txt

  Scenario: classifyScreenState returns "unknown" for blank/null input
    Tool: Bash
    Preconditions: utils.js written
    Steps:
      1. Call classifyScreenState(null)
      2. Assert return === "unknown"
    Expected Result: Graceful handling of null/undefined input
    Evidence: .omo/evidence/task-3-null-input.txt
  ```

  **Commit**: YES (with Task 1)
  - Message: `feat: add utility functions for screen classification and ROI`

- [x] 4. **detection.js — Template Matching Engine (Multi-Template)**

  **What to do**:
  - Create the mushroom detection module supporting **~12 template types**:
    - `loadAllTemplates(templateDir)` → Reads ALL .png files from directory, returns array of `{name, image, w, h}` objects. Returns empty array if dir missing.
    - `findMushrooms(screenImage, templates, config)` → Iterates over ALL loaded templates, returns first match found (or array of all matches)
    - `nms(matches, overlapThreshold)` → Non-Maximum Suppression: sort by confidence descending, discard overlapping matches with IoU > threshold (default 0.3)
    - `recycleAllTemplates(templates)` → Cleanup all template images at script end
  - Implement `loadAllTemplates` logic:
    1. Use `files.listDir(templateDir)` or similar to get all .png files
    2. Or: read `detection.templateDir` from config, scan for `detection.templatePattern`
    3. For each file, call `images.read(path)` to load the template Image
    4. Store `{ name: filename, image: Image, width: imgW, height: imgH }` in array
    5. Log how many templates loaded
    6. If directory missing or empty: return empty array (script handles this in main.js)
  - Implement `findMushrooms` logic (CRITICAL — performance matters with 12 templates):
    1. If `templates` array is empty → return empty array immediately
    2. Use `getGameMapRegion()` from utils for search region
    3. **Iterate over templates**: for each template:
       a. Call `images.findImage(screenImage, template.image, { threshold: config.detection.threshold, region: ... })`
       b. If match found AND `config.detection.breakOnFirstMatch === true`:
          - Return `[{x, y, confidence, templateName: template.name, width: template.w, height: template.h}]` immediately
          - **Early break** — no need to check remaining 11 templates
       c. If NOT breaking on first match: collect ALL matches from ALL templates, NMS-across-templates, return best
    4. **Performance optimization**: Templates are loaded ONCE at startup and reused for every capture cycle. No disk I/O per capture.
    5. After ALL templates checked with no match → return empty array
  - Wrap ALL template file reads in `try/catch` — if one .png is corrupted, skip it and log, don't crash
  - Export via `module.exports = { loadAllTemplates, findMushrooms, nms, recycleAllTemplates }`

  **Must NOT do**:
  - Don't call `captureScreen()` here — screen image is passed as parameter
  - Don't load templates from disk every capture cycle — load once at startup
  - Don't hardcode template path or region — read from config
  - Don't recycle the input `screenImage` — ownership belongs to caller
  - Don't throw exceptions on bad templates — skip them with logged warning
  - Don't hardcode 12 — the code must work with ANY number of templates (1 to 50)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Template matching with NMS across multiple templates, performance optimization for 12-template iteration, proper batch lifecycle management

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 5)
  - **Blocks**: Tasks 6 (scanner) and 7 (main)
  - **Blocked By**: None (imports config structure only)

  **References**:
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/detection.js` — Reference template matching with NMS (key patterns to adapt)
  - `https://ys1231.github.io/AutoJs6/image.html#m-images-findImage` — AutoJs6 findImage API
  - Metis finding: Template matching is NOT scale/rotation invariant — document this constraint prominently
  - AutoJs6 `files` module: `https://ys1231.github.io/AutoJs6/files.html` — for directory listing

  **Acceptance Criteria**:
  - [ ] `loadAllTemplates()` reads ALL .png files from template directory, returns array of `{name, image, w, h}`
  - [ ] `loadAllTemplates()` returns empty array (not crash) if directory missing or empty
  - [ ] `findMushrooms()` iterates over all loaded templates, returns match on first hit if `breakOnFirstMatch=true`
  - [ ] `findMushrooms()` checks ALL templates if `breakOnFirstMatch=false` and returns best overall
  - [ ] `nms()` correctly removes overlapping matches (IoU > 0.3) both within and across templates
  - [ ] `recycleAllTemplates()` releases all template Image objects
  - [ ] Corrupted/missing individual template file → skipped with warning, not crash
  - [ ] Module exports all 4 functions

  **QA Scenarios**:
  ```
  Scenario: loadAllTemplates loads multiple files
    Tool: Bash
    Preconditions: detection.js written, template dir with 3 test .png files
    Steps:
      1. var templates = loadAllTemplates("/tmp/test_templates/")
      2. Assert templates.length === 3
      3. Assert each has .name, .image, .width, .height
    Expected Result: Exactly 3 templates loaded with correct properties
    Evidence: .omo/evidence/task-4-load-templates.txt

  Scenario: findMushrooms breaks early on first match
    Tool: Bash
    Preconditions: detection.js written, 2 templates, screen with match for template 1
    Steps:
      1. Call findMushrooms(screen, templates, {breakOnFirstMatch: true, threshold: 0.8})
      2. Assert only 1 findImage operation was performed (fast path)
      3. Assert match.templateName === "template1.png"
    Expected Result: Early break — only first matching template checked
    Evidence: .omo/evidence/task-4-early-break.txt

  Scenario: findMushrooms checks all templates when no match
    Tool: Bash
    Preconditions: detection.js written, screen with NO mushroom match
    Steps:
      1. Call findMushrooms(screen, [tpl1, tpl2, tpl3], {breakOnFirstMatch: true, threshold: 0.9})
      2. Assert ALL 3 templates were checked (no early break possible — none matched)
      3. Assert return is empty array
    Expected Result: All templates tried, none matched, empty result
    Evidence: .omo/evidence/task-4-all-tried.txt

  Scenario: Empty template directory handled gracefully
    Tool: Bash
    Preconditions: detection.js written, empty template dir
    Steps:
      1. var templates = loadAllTemplates("/tmp/empty_dir/")
      2. Call findMushrooms(screen, templates, config)
      3. Assert return is empty array (no crash)
    Expected Result: Graceful empty result
    Evidence: .omo/evidence/task-4-empty-dir.txt
  ```

  **Commit**: YES (with Task 1)
  - Message: `feat: add multi-template matching engine with batch loading and NMS`

- [x] 5. **floaty.js — Floating Window UI Framework**

  **What to do**:
  - Create a floating window module using AutoJs6 `floaty.rawWindow()`:
    - `createFloaty()` → Creates and returns the floaty window
    - `updateStatus(w, text)` → Updates the status text on the floaty
    - `destroyFloaty(w)` → Closes the floaty window cleanly
  - Floaty layout (using AutoJs6 E4X XML inline syntax — supported in v6.7.0+):
    - Small semi-transparent panel, positioned in top-right corner
    - Shows status text: "Searching...", "Mushroom Found!", "Error: ...", "Stopped"
    - Uses `setTouchable(false)` so swipe gestures pass through to the game
    - Uses `setPosition(device.width - 200, 100)` for corner positioning
    - Size: ~180x80 pixels (small enough not to obscure map)
    - Background: semi-transparent dark (#CC000000) with white text
    - Text centered, with padding
  - Implement the auto-hide pattern for scanning:
    - `showDuringScan(w, show)` — When scanning starts, floaty auto-minimizes or becomes fully transparent to prevent ANY touch interference
    - When mushroom found or error, floaty becomes visible again
  - Do NOT require `"ui"` directive at script top (floaty module works in non-UI mode in AutoJs6 v6.6.2+)
  - Export via `module.exports = { createFloaty, updateStatus, destroyFloaty, showDuringScan }`

  **Must NOT do**:
  - Don't use `floaty.window()` — use `floaty.rawWindow()` for `setTouchable()` support
  - Don't call `console.show()` anywhere — floaty is the only overlay
  - Don't use string-concatenation XML — use proper E4X XML syntax (e.g., `<frame>...</frame>`)
  - Don't add interactive controls/buttons in v1 (future feature)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Android overlay window API, AutoJs6-specific floaty quirks, touch pass-through concerns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4)
  - **Blocks**: Task 7 (main)
  - **Blocked By**: None

  **References**:
  - `https://ys1231.github.io/AutoJs6/floaty.html` — AutoJs6 floaty module docs
  - `https://github.com/SuperMonster003/AutoJs6/issues/122` — Android 13+ setTouchable issues
  - Metis finding: On Android 13+, `setTouchable(false)` may not work on MIUI/HyperOS. Document this known limitation.
  - AutoJs6 v6.7.0 release note: String XML fixed — E4X inline XML syntax works directly

  **Acceptance Criteria**:
  - [ ] `createFloaty()` creates a visible floating window
  - [ ] `updateStatus()` changes text (test with "Test", "Searching...", "Found!")
  - [ ] `setTouchable(false)` is called — touch events pass through to game
  - [ ] Floaty window positioned in top-right corner
  - [ ] `destroyFloaty()` removes the window cleanly
  - [ ] AutoJS does not crash or show errors on floaty creation

  **QA Scenarios**:
  ```
  Scenario: Floaty window creates and updates
    Tool: Bash
    Preconditions: floaty.js written
    Steps:
      1. In test script: var f = require('./floaty.js'); var w = f.createFloaty();
      2. f.updateStatus(w, "Searching...")
      3. sleep(2000)
      4. f.updateStatus(w, "Found!")
      5. sleep(1000)
      6. f.destroyFloaty(w)
    Expected Result: Window appears with text updates, no errors in console
    Evidence: .omo/evidence/task-5-floaty-status.txt

  Scenario: Floaty touch pass-through
    Tool: Bash (device test)
    Preconditions: floaty.js running on device with game open
    Steps:
      1. Create floaty with setTouchable(true)
      2. Try swiping the map — gesture should NOT pass through
      3. Destroy and recreate with setTouchable(false)
      4. Swipe map — gesture SHOULD pass through
    Expected Result: setTouchable(false) allows game to receive touch events
    Evidence: .omo/evidence/task-5-touch-pass.txt
  ```

  **Commit**: YES (with Task 1)
  - Message: `feat: add floating window UI framework for status display`

- [x] 6. **scanner.js — Scan Loop with Zigzag Scroll**

  **What to do**:
  - Create the main scan loop module — THE core logic of the entire script:
    - `startScanning(config, templates, onFound)` → Starts the infinite scan loop (`templates` array is pre-loaded from detection.js)
    - `stopScanning()` → Sets shutdown flag for graceful stop
    - `isScanning()` → Returns boolean (is scan loop active)
  - Implement the **vertical zigzag scroll pattern**:
    1. **Direction cycle**: Left → Left → Left → (shift down) → Right → Right → Right → (shift down) → Left...
    2. Each "sweep" = 3 consecutive swipes in the same horizontal direction
    3. After each sweep, shift vertically by `config.scan.verticalShiftPercent` of screen height
    4. Use `config.scan.overlapPercent` to determine swipe distance (leave 40% overlap between consecutive swipes)
    5. Swipe coordinates:
       - Start: ~60% from edge of screen (to leave room for the gesture)
       - End: ~40% from opposite edge
       - Y-position: centered vertically (device.height / 2)
    6. Between each swipe: wait `config.scan.settleDelay` ms for map inertia to settle
   - After EACH swipe:
    1. Wait settle delay
    2. `captureScreen()` → wrapped in try/finally
    3. `classifyScreenState()` from utils — if not "map_visible", log warning and skip detection
    4. `findMushrooms(screenImage, templates, config)` from detection module — iterates over ALL loaded templates, breaks early on first match
    5. If matches found (array non-empty):
       - Log match: confidence, position
       - Call `saveScreenshotToGallery()` from utils
       - Call `onFound(match)` callback (provided by main.js)
       - Return from scan loop (stops)
  - Implement **chunked-wait interrupt pattern**:
    - Before each capture, check `_shutdown_requested` flag
    - If set, clean up and return (graceful stop)
    - Volume key handler sets this flag (via `events.onKeyDown`)
    - Swipe duration capped at `config.scan.swipeDuration` (default 600ms, max 2000)
   - Implement **error recovery**:
     - If `captureScreen()` returns null → retry once after 2s
     - If screen state not "map_visible" for 3 consecutive captures → log warning, continue scanning
     - Templates are pre-loaded by main.js — scanner does NOT check template existence (handled at startup)
  - Track state:
    - `_shutdown_requested` (boolean)
    - `_sweepCount` (how many sweeps completed)
    - `_totalSwipes` (total swipe count for stats)
  - Export via `module.exports = { startScanning, stopScanning, isScanning }`

  **Must NOT do**:
  - Don't use `console.show()` — use floaty for status display
  - Don't hardcode any values — all from config.js
  - Don't let `swipe()` duration exceed 2000ms (blocks interrupt handling)
  - Don't recycle images that are owned by caller
  - Don't call `engines.myEngine().stop()` as first shutdown option (only as double-press force stop)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: This is the most complex module — scan loop state machine, zigzag coordinate math, interrupt handling, error recovery, image lifecycle management. Needs deep understanding of all other modules.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Wave 1)
  - **Blocks**: Task 7 (main)
  - **Blocked By**: Tasks 2 (config), 3 (utils), 4 (detection)

  **References**:
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/scanner.js:35-69` — Volume key interrupt pattern (two-press graceful/force)
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/scanner.js:203` — Chunked-wait pattern for interrupt checking
  - Metis finding: `events.observeKey()` MUST be called BEFORE `events.onKeyDown()` listeners
  - Metis finding: `swipe()` is blocking — interrupt can only fire between swipes, not during
  - `https://ys1231.github.io/AutoJs6/events.html` — AutoJs6 events API

  **Acceptance Criteria**:
  - [ ] `startScanning()` begins the infinite scan loop
  - [ ] Vertical zigzag pattern: left sweep × 3 → shift down → right sweep × 3 → shift down → repeat
  - [ ] After each swipe: settle delay → capture → classify → detect
  - [ ] When mushroom detected: callback fires, loop stops
  - [ ] `stopScanning()` sets shutdown flag, loop exits gracefully at next check point
  - [ ] Volume key single press → graceful stop; double press → force stop
  - [ ] `captureScreen()` null → retry once, then log and continue
  - [ ] 3 consecutive non-map_visible states → warning but continue
  - [ ] Template missing → error display, scanner stops

  **QA Scenarios**:
  ```
  Scenario: Zigzag coordinate computation
    Tool: Bash
    Preconditions: scanner.js with config values
    Steps:
      1. Mock device.width=1080, device.height=2400
      2. Compute first 3 swipe coordinates (left sweep)
      3. Assert all start/end X values are within [0, 1080]
      4. Assert Y values are within status/nav bar boundaries
    Expected Result: All computed coordinates are valid screen coordinates
    Evidence: .omo/evidence/task-6-zigzag-coords.txt

  Scenario: Shutdown flag stops loop
    Tool: Bash
    Preconditions: scanner.js
    Steps:
      1. Call startScanning(config, onFoundCallback)
      2. After first swipe completes, call stopScanning()
      3. Assert _shutdown_requested === true
      4. Assert scanning loop exits within 3 seconds
    Expected Result: Graceful stop within interrupt check window
    Evidence: .omo/evidence/task-6-shutdown.txt
  ```

  **Commit**: YES
  - Message: `feat: add scanner with vertical zigzag scroll loop and interrupt handling`

- [x] 7. **main.js — Entry Point Orchestration**

  **What to do**:
  - Refactor the existing `main.js` from the hello-world stub to the full entry point:
   - **Phase 1 — Setup**:
    1. Load config: `var config = require('./config.js');`
    2. Load all modules: `utils`, `detection`, `scanner`, `floaty`
    3. **Load all templates**: `var templates = detection.loadAllTemplates(config.detection.templateDir);`
       - If templates array is empty (dir missing or no .png files): show error toast with path + exit
       - If > 0: log `"Loaded N mushroom templates from [dir]"` to console + update floaty status
    4. Request screen capture permission: `images.requestScreenCapture()` + error handling
    5. Create floating window: `var floatyW = floatyModule.createFloaty();`
    6. Set up volume key interrupt:
       ```javascript
       // ORDER MATTERS: observeKey() BEFORE onKeyDown()
       events.observeKey();
       events.onKeyDown("volume_up", function(event) { ... });
       ```
  - **Phase 2 — Launch**:
    1. Launch Pikmin Bloom: `app.launchPackage(config.app.packageName)`
    2. Wait for launch with timeout: chunked wait with `waitForPackage()` + fallback polling
    3. Wait for map screen: capture + classify in loop until `isMapVisible` or timeout
    4. Update floaty status: "Launching...", "Waiting for map...", "Searching..."
  - **Phase 3 — Scan**:
    1. Call `scanner.startScanning(config, onFound)`
    2. Update floaty to "Searching..."
    3. The `onFound(match)` callback:
       - Update floaty: "Large Mushroom Found!"
       - Save screenshot: `utils.saveScreenshotToGallery(captureScreen())`
       - Show toast notification
       - Return (stops scanning)
  - **Phase 4 — Cleanup**:
    1. After scan ends (found or shutdown):
       - Update floaty to final status ("Found!" or "Stopped")
       - Keep floaty visible for 3 seconds for user to see
       - Destroy floaty window: `floatyModule.destroyFloaty(floatyW)`
       - Exit script
  - Handle all error states:
    - Screen capture permission denied → toast + exit
    - App package not found → toast + exit
    - App launch timeout → toast + exit
    - Template file missing → toast + exit
    - captureScreen() persistently null → toast + exit after 3 retries

  **Must NOT do**:
  - Don't duplicate logic that belongs in other modules (scanner runs the scan, not main)
  - Don't use `"ui"` directive (floaty module works without it)
  - Don't call `exit()` without cleanly destroying the floaty first

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Orchestration logic, error handling, module coordination — needs understanding of all other files

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential, after scanner)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: All Wave 1 tasks (config, utils, detection, floaty) + Task 6 (scanner)

  **References**:
  - `/home/henry/code/autojs/main.js` — Current stub to replace
  - `/home/henry/code/game/autojs-mushroom-hunter/autojs/main.js` — Reference entry point pattern
  - Metis finding: `events.observeKey()` before `onKeyDown()` — critical ordering
  - Metis finding: Don't use `console.show()` and floaty simultaneously
  - `https://ys1231.github.io/AutoJs6/app.html` — app.launchPackage API

  **Acceptance Criteria**:
  - [ ] Script starts, loads all modules, checks template existence
  - [ ] Screen capture permission requested (errors handled gracefully)
  - [ ] Floaty window created and shows "Launching..." status
  - [ ] Pikmin Bloom launched, script waits for map screen
  - [ ] Scanner starts, floaty shows "Searching..."
  - [ ] On mushroom found: screenshot saved, floaty shows "Found!", clean exit
  - [ ] On volume key: floaty shows "Stopped", clean exit
  - [ ] On error: floaty shows error message, clean exit
  - [ ] All images recycled, no memory leaks

  **QA Scenarios**:
  ```
  Scenario: Full startup sequence (config loading)
    Tool: Bash (dry-run with node syntax check)
    Preconditions: All task files written
    Steps:
      1. Verify all require() paths resolve
      2. Check events.observeKey() appears before events.onKeyDown()
      3. Check no console.show() calls
      4. Check exit() is always preceded by floaty destroy
    Expected Result: Code structure is correct, no anti-patterns
    Evidence: .omo/evidence/task-7-code-review.txt
  ```

  **Commit**: YES
  - Message: `feat: add main entry point with full orchestration and error handling`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, check code). For each "Must NOT Have": search codebase for hardcoded pixels, GPS spoofing, console.show() — reject with file:line if found. Check evidence files exist. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run through all `.js` files checking for: missing `.recycle()` calls, `swipe()` duration > 2000ms, hardcoded pixel values, `console.show()` + floaty coexistence, improper `events.observeKey()` ordering. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `API Usage [PASS/FAIL] | Memory Safety [PASS/FAIL] | Patterns [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA on Device** — `unspecified-high`
  Transfer scripts to device. Test each scenario:
  - Script launches → checks if template exists at configured path
  - Floaty window appears with status text
  - Volume key sets shutdown flag
  - Verify no syntax errors from AutoJs6 engine
  Verify: Volume key interrupt, floaty display, config loading.
  Output: `Scenarios [N/N pass] | Device Tests [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual code. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Post-Completion Fix: Template Path Co-Location

**Issue**: `config.js` `templateDir` pointed to `/sdcard/autojs/templates/` — a shared directory
separate from the script. The mushroom PNGs are script-specific and should live alongside the code.

**Fix A** (1 line in config.js):
- Line 131: Change `templateDir: '/sdcard/autojs/templates/'` → `templateDir: './templates/'`
- User must place ~12 mushroom template PNGs in `./templates/` (subfolder of the script directory)
- ✅ Done

**Fix B** (revert requires):
`__dir__` is not available in VSCode remote/cache mode either. For on-device execution (the user's chosen workflow), standard `require('./module')` works fine. Revert all `require(__dir__ + "/module.js")` back to `require('./module')` (without `.js` extension to match original pattern).

---

## Commit Strategy

- **1**: `chore: scaffold AutoJs6 project structure` — project.json, all .js files
- **2-5**: `feat: add config module` / `feat: add utility functions` / `feat: add detection engine` / `feat: add floaty UI`
- **6**: `feat: add scanner with zigzag scroll loop`
- **7**: `feat: add main entry point and orchestration`

---

## Success Criteria

### Verification Commands (run on device via AutoJs6)
```javascript
// Quick syntax check (in AutoJs6 console)
var files = ["config.js", "utils.js", "detection.js", "floaty.js", "scanner.js", "main.js"];
files.forEach(function(f) { try { var m = require(f); } catch(e) { console.log(f + ": " + e.message); } });
```

### Final Checklist
- [ ] All "Must Have" present in code
- [ ] All "Must NOT Have" absent from code
- [ ] Script runs without syntax errors on AutoJs6 v6.7.0+
- [ ] Floating window displays without blocking swipe gestures
- [ ] Volume key shutdown works (single = graceful, double = force)
