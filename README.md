# Pikmin Bloom Mushroom Finder

AutoJS6 script that automatically navigates to the Pikmin Bloom map and scans for large mushrooms using screen template matching.

## How It Works

```
Config Dialog → Load Templates → Launch Game → Navigate to Map → Scan for Mushrooms
```

The script runs a 4-phase pipeline:

1. **Config** — Show a settings dialog to adjust detection parameters
2. **Setup** — Load mushroom template images, request screen capture permission, create a floating log panel
3. **Navigate** — Use a screen template state machine to guide the game from any screen to the mushroom map
4. **Scan** — Zigzag swipe pattern across the map, capture frames, and run template matching to find mushrooms

## Prerequisites

- **Android device** (AutoJS6 runs on Android)
- **[AutoJS6](https://github.com/SuperMonster002/AutoJS6)** installed
- **Pikmin Bloom** installed on the device
- **Screen capture permission** granted to AutoJS6
- Template images captured (see below)

## Project Structure

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

## Setup

### 1. Install AutoJS6

Install [AutoJS6](https://github.com/SuperMonster002/AutoJS6) on your Android device and grant it the required permissions (screen capture, overlay, accessibility).

### 2. Deploy the script

Copy the entire `autojs/` folder to your device. In AutoJS6, open the project folder so `main.js` is the entry point.

### 3. Capture navigation templates

The navigator uses screenshot templates to recognize UI elements. For each navigation template:

1. Navigate manually to the screen containing the button you want to detect
2. Take a screenshot
3. Crop the image to just the button/icon
4. Save it with the matching filename in `templates/navigation/`

| Template File | What to capture | What the script does with it |
|---|---|---|
| `Close1.jpg` | A close/dismiss button | Detects it on screen → taps its center |
| `Close2.jpg` | Another close button variant | Same as Close1 (tried if Close1 not found) |
| `Close3.jpg` | Another close button variant | Same (tried if Close1/Close2 not found) |
| `Back.jpg` | A back/return button | Taps it to go back (tried last among dismiss buttons) |
| `Go to map.jpg` | The "Go to map" button | Taps it to enter the map |
| `Map view.jpg` | The map view button/icon | Taps its center to open the mushroom map |
| `Map view3.jpg` | The mushroom map view itself | Detects this → immediately triggers scan phase |

**Priority order during navigation:**
1. Dismiss any popup/overlay (Close1 → Close2 → Close3 → Back)
2. Tap "Go to map" button
3. Check if already on the mushroom map (Map view3) — if found, skip straight to scanning
4. Tap "Map view" button to enter the map
5. Loop back to step 1 until map is reached or timeout

### 4. Capture mushroom templates

For each mushroom type you want to detect:

1. Be on the mushroom map with the mushroom visible
2. Take a screenshot
3. Crop the image to just the mushroom icon
4. Save it in `templates/mushrooms/`

The script will scan for all images in `templates/mushrooms/` during the scan phase. When one matches on screen, the scan stops and the match is reported.

## How to Run

1. Open the script folder in AutoJS6
2. Run `main.js`
3. The pre-flight config dialog appears — adjust settings if needed, then tap **Start**
4. The script will:
   - Load mushroom templates
   - Request screen capture permission
   - Create a floating log panel (top-left, transparent, shows red progress text)
   - Launch Pikmin Bloom (or wait for you to open it)
   - Navigate to the mushroom map using visual template matching
   - Start zigzag swiping across the map, capturing frames and detecting mushrooms
5. When a mushroom is found:
   - The panel shows "Large Mushroom Found!" with the template name and coordinates
   - A screenshot is saved to the device gallery
   - The script exits after 3 seconds
6. To stop manually: press **Volume Up** once for graceful stop, twice for force stop

### Floating Panel

A transparent, draggable panel appears at the top-left corner of the screen:

```
×                         ← Close button (top-right)
[15:32:01] Config applied
[15:32:05] Loading navigation templates...
[15:32:10] Map reached via navigation
[15:32:15] Starting scan loop
```

- **Red text** on transparent background
- **Scrollable** — up to 4 visible lines, scroll for history
- **Draggable** — drag the title bar to reposition
- **Auto-hides** during screen capture so it never blocks detection
- A **red dot** briefly flashes at each tap point to show where the script is pressing

### Click Feedback

Whenever the script taps the screen, a small red dot (18dp) appears at the exact tap coordinates for ~800ms. This lets you see exactly where the script is pressing — useful for verifying template matches and debugging navigation.

## Configuration

### Pre-flight Dialog (shown on start)

| Setting | Range | Default | Description |
|---|---|---|---|
| Confidence threshold | 0.70 – 0.99 | 0.85 | How closely a template must match (lower = more matches, more false positives) |
| Swipes per row | 1 – 6 | 3 | Consecutive horizontal swipes before shifting down |
| Settle delay | 500 – 10000 ms | 2500 ms | Wait time after each swipe for map tiles to render |
| Auto-launch | On/Off | On | Whether to auto-launch Pikmin Bloom |
| Debug mode | On/Off | Off | Extra logging for troubleshooting |

### Config File (`config.js`)

Advanced settings can be adjusted directly in `config.js`:

| Key | Default | Description |
|---|---|---|
| `app.packageName` | `com.nianticlabs.pikmin` | Game package name |
| `app.launchTimeout` | 30000 ms | Max wait for app to launch |
| `app.mapTransitionTimeout` | 15000 ms | Max wait for map transition |
| `scan.settleDelay` | 2500 ms | Post-swipe settle delay |
| `scan.swipeDuration` | 600 ms | Speed of each swipe gesture |
| `scan.overlapPercent` | 0.4 | Overlap between adjacent swipes |
| `scan.verticalShiftPercent` | 0.6 | Vertical distance between scan rows |
| `scan.sweepCountPerRow` | 3 | Swipes per horizontal row |
| `detection.threshold` | 0.85 | Template match confidence threshold |
| `detection.maxMatches` | 5 | Max candidates after dedup |
| `detection.nmsOverlap` | 0.3 | IoU threshold for dedup |
| `detection.breakOnFirstMatch` | true | Stop scanning on first detection |
| `screenshot.outputDir` | `/sdcard/DCIM/PikminMushroomFinder/` | Screenshot save location |

## Scan Pattern

The scan uses a vertical zigzag pattern:

```
Sweep 1:  ←──────────  (left, top row)
Sweep 2:  ←──────────  (left, top row)
Sweep 3:  ←──────────  (left, top row)
          ↓ shift down
Sweep 4:  ──────────→  (right, next row)
Sweep 5:  ──────────→  (right, next row)
Sweep 6:  ──────────→  (right, next row)
          ↓ shift down
          ... repeat ...
```

After each swipe, the script:
1. Waits for the map to settle (`settleDelay`)
2. Captures the screen
3. Runs template matching against all mushroom templates
4. If a match is found → reports it and stops
5. If no match → continues to the next swipe

The scan runs **indefinitely** until a mushroom is found or the user stops it.

## Template Matching Details

- Uses AutoJS6's `images.findImage()` with a configurable confidence threshold
- Results are deduplicated using Non-Maximum Suppression (NMS)
- On each match, the template's `name`, screen coordinates, and confidence score are returned
- When `breakOnFirstMatch` is enabled (default), the scan stops at the first valid detection

## Troubleshooting

### "Navigation timed out"
- Your navigation templates might not match what's on screen
- Recapture the templates — make sure they're cropped to just the button/icon
- Try lowering the match threshold in the config dialog

### "No mushroom templates found"
- Place at least one `*.jpg` or `*.png` in `templates/mushrooms/`
- The `templates/` directory must exist relative to the script location

### "Screen capture permission denied"
- Go to Android Settings → Apps → AutoJS6 → Permissions
- Grant "Display over other apps" and "Screen capture" permissions

### Scan runs but never finds mushrooms
- The detection threshold might be too high — try lowering it in the config dialog
- Your mushroom templates might not match the actual in-game appearance — recapture them with different lighting/zoom levels
- Check the log panel for what the script is doing between swipes

### Red dot appears in the wrong position
- The red dot indicator uses screen pixel coordinates. If it appears slightly offset from where the tap lands, it may be due to the status bar height — check `device.statusBarHeight` is being detected correctly

## Volume Key Controls

| Action | Effect |
|---|---|
| Single press Volume Up | Graceful stop (current swipe completes, then exits) |
| Double press Volume Up | Force stop (immediate exit) |

## Notes

- All screen taps use a **1000ms press** duration (long press) — this is intentional for in-game UI responsiveness
- The floating panel is moved **off-screen** during `captureScreen()` calls so it never appears in detection frames
- Template images in `templates/navigation/Map view2.jpg` and `Go to map2.jpg` are intentionally not used (reserved)
