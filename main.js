/**
 * main.js
 *
 * Entry-point for the Pikmin Bloom Mushroom Finder.
 * Orchestrates the 4-phase pipeline:
 *   Phase 0 — Config    : Show settings dialog, user taps Start
 *   Phase 1 — Setup    : Load templates, request capture permission, create panel
 *   Phase 2 — Launch   : Launch app, wait for map screen
 *   Phase 3 — Scan     : Run mushroom detection scan loop
 *   Phase 4 — Cleanup  : Show status, destroy panel
 *
 * Volume keys are handled by scanner.js at module load time:
 *   Single press  → graceful shutdown (scan loop exits → main() cleans up)
 *   Double press  → force stop (engines.myEngine().stop() — immediate)
 * Do NOT add additional volume-key handling here.
 */

"auto";

var config    = require("./config");
var utils     = require("./utils");
var detection = require("./detection");
var scanner   = require("./scanner");
var floatyMod = require("./floaty");
var configUi  = require("./config_ui");
var navigator = require("./navigator");

// ---------------------------------------------------------------------------
// cleanupAndExit — shared error/exit helper
//
// Every error path after the panel is created MUST call this instead
// of calling exit() directly, so the panel is always cleaned up.
// ---------------------------------------------------------------------------

function cleanupAndExit(panel, statusText, toastMsg) {
  if (panel) {
    floatyMod.updateStatus(panel, statusText);
    floatyMod.appendLog(panel, statusText);
    floatyMod.showDuringScan(panel, true);
    sleep(2000);
    floatyMod.destroy(panel);
  }
  if (toastMsg) {
    toast(toastMsg);
  }
  exit();
}

// ---------------------------------------------------------------------------
// main — entry point
// ---------------------------------------------------------------------------

function main() {
  // ===================================================================
  // Phase 0 — Pre-flight Configuration Dialog
  // ===================================================================

  var settings = configUi.showConfigDialog();
  if (!settings) {
    // User clicked Exit or cancelled
    exit();
  }

  // Apply dialog settings to config
  config.detection.threshold = settings.threshold;
  config.scan.sweepCountPerRow = settings.sweepCount;
  config.debug.enabled = settings.debugMode;
  config.scan.settleDelay = settings.settleDelay;
  config.detection.detectLargeColor = settings.detectLargeColor;

  console.info("Config: threshold=" + settings.threshold +
    ", sweepCount=" + settings.sweepCount +
    ", settleDelay=" + settings.settleDelay +
    ", autoLaunch=" + settings.autoLaunch +
    ", debug=" + settings.debugMode);

  // ===================================================================
  // Phase 1 — Setup
  // ===================================================================

  // ---- 1a. Load templates -------------------------------------------
  console.info(
    "Loading templates from '" + config.detection.templateDir + "' ..."
  );
  var templates = detection.loadAllTemplates(config.detection.templateDir, { excludeDirs: ["navigation"] });

  if (templates.length === 0) {
    var errMsg =
      "No mushroom templates found at " +
      config.detection.templateDir +
      ". Place .png files and restart.";
    toast(errMsg);
    console.error(errMsg);
    exit();
  }

  console.info("Loaded " + templates.length + " template(s)");

  // Filter out "large color" templates if user disabled them
  if (!config.detection.detectLargeColor) {
    var before = templates.length;
    templates = templates.filter(function(t) {
      return t.name.indexOf("large color") === -1;
    });
    console.info("Filtered large color templates: " + before + " → " + templates.length);
  }

  // ---- 1b. Minimal log panel (must exist before any logging) -----------
  var panel = floatyMod.createControlPanel(function() {
    scanner.stopScanning();
    floatyMod.destroy(panel);
    exit();
  });
  floatyMod.appendLog(panel, "Config applied, starting scan");

  // Stop the script via volume keys (set up in scanner.js).
  //   Single volume press  → graceful stop
  //   Double volume press  → force stop

  // ---- 1d. onFound callback --------------------------------------------
  function onFound(match) {
    floatyMod.updateStatus(panel, "Large Mushroom Found!");
    floatyMod.appendLog(panel, "Found \"" + match.templateName + "\" at (" +
      match.x + "," + match.y + ")");
    floatyMod.showDuringScan(panel, true);

    var tapX = match.x + Math.round(match.w / 2);
    var tapY = match.y + Math.round(match.h / 2);
    floatyMod.appendLog(panel, "Clicking mushroom at (" + tapX + "," + tapY + ")");
    press(tapX, tapY, 1000);
  }

  // ===================================================================
  // Phase 2 — Launch
  // ===================================================================

  // Load navigation templates early (includes pikmin icon templates
  // used to visually launch the game from the home screen).
  var navTemplates = navigator.loadNavigationTemplates(config.detection.templateDir);

  // ---- 2a. Launch / bring-to-foreground Pikmin Bloom -----------------

  if (settings.autoLaunch) {
    floatyMod.updateStatus(panel, "Launching Pikmin Bloom...");
    floatyMod.appendLog(panel, "Launching " + config.app.packageName + "...");
    app.launchPackage(config.app.packageName);

    // Give the app a few seconds to load — splash/permission screens
    // often show as com.android.systemui during this window
    sleep(3000);

    // If system UI is in foreground, try tapping to dismiss overlay dialogs.
    // Android permission dialogs show as com.android.systemui. We try:
    //   1. Center tap (might hit a consent button)
    //   2. Bottom-center tap (common for "Allow" buttons on permission dialogs)
    var pkg = currentPackage();
    if (pkg === "com.android.systemui") {
      floatyMod.appendLog(panel, "System UI in foreground — tapping to dismiss overlay...");
      var cx = Math.round(device.width / 2);
      var cy = Math.round(device.height / 2);
      press(cx, cy, 800);
      sleep(1500);
      // Try bottom-center too (where "Allow" buttons often appear)
      var botCy = Math.round(device.height * 0.85);
      press(cx, botCy, 800);
      sleep(2000);
    }

    floatyMod.appendLog(panel, "App is in foreground");
  } else {
    // Manual launch — wait for user to open the game
    floatyMod.updateStatus(panel, "Open the game manually...");
    floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
    sleep(5000);
    floatyMod.appendLog(panel, "Assuming game is open, proceeding to navigation...");
  }

  // ---- 2b. Navigate to map using visual templates -------------------
  floatyMod.updateStatus(panel, "Navigating to map...");

  if (navTemplates.length > 0) {
    floatyMod.appendLog(panel, "Navigating (" + navTemplates.length + " guides)...");

    var mapReached = false;
    try {
      mapReached = navigator.navigateToMap(navTemplates, config, panel);
    } catch (e) {
      console.error("navigateToMap threw: " + e);
      floatyMod.appendLog(panel, "Navigation error: " + e);
    }
    if (!mapReached) {
      cleanupAndExit(
        panel,
        "Error: Navigation failed",
        "Timed out trying to reach the game map. " +
          "Check your navigation templates and restart."
      );
    }
    floatyMod.appendLog(panel, "=== Map view reached! Starting scan... ===");

    // Recycle navigation templates — no longer needed
    detection.recycleAllTemplates(navTemplates);
  } else {
    // No navigation templates — fall back to heuristics-based detection
    floatyMod.appendLog(panel, "No navigation guides — polling for map...");

    var mapReady = false;
    var mapStart = new Date().getTime();

    while (new Date().getTime() - mapStart < config.app.mapTransitionTimeout) {
      var img = null;
      try {
        img = captureScreen();
        if (img) {
          var state = utils.classifyScreenState(img);
          if (state === "map_visible") {
            mapReady = true;
            break;
          }
        }
      } finally {
        if (img) {
          img.recycle();
        }
      }
      sleep(2000);
    }

    if (!mapReady) {
      cleanupAndExit(
        panel,
        "Error: Map not found",
        "Timed out waiting for the game map. " +
          "Check that the game is on the map screen and restart."
      );
    }

    floatyMod.appendLog(panel, "Map screen detected");
  }

  // ===================================================================
  // Phase 3 — Scan
  // ===================================================================

  // Re-establish screen capture NOW (game is in foreground, navigation
  // just completed).  Requesting it earlier (before the app launched)
  // may result in an expired session by this point.
  var captureGranted = false;
  try {
    captureGranted = images.requestScreenCapture(false);
  } catch (e) {
    console.warn("images.requestScreenCapture threw: " + e);
  }
  if (!captureGranted) {
    cleanupAndExit(
      panel,
      "Error: Capture denied",
      "Screen capture permission denied. Grant permission and restart."
    );
  }

  floatyMod.updateStatus(panel, "Searching...");
  floatyMod.appendLog(panel, "Starting scan loop");

  // BLOCKING — runs the full scan loop until mushroom found or Stop.
  scanner.startScanning(config, templates, onFound, panel);

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  if (scanner.wasUserStop()) {
    floatyMod.appendLog(panel, "Scan stopped by user");
    floatyMod.destroy(panel);
    return;
  }

  // Mushroom found — keep panel visible briefly so user can read the log
  floatyMod.appendLog(panel, "Scan finished");
  sleep(3000);
  floatyMod.destroy(panel);
}

// Auto-execute
main();
