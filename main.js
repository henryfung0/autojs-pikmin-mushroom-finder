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

  // ---- 1b. Request screen-capture permission -------------------------
  var captureGranted = false;
  try {
    captureGranted = images.requestScreenCapture(false);
  } catch (e) {
    console.warn("images.requestScreenCapture threw an exception: " + e);
  }

  if (!captureGranted) {
    toast("Screen capture permission denied. Grant permission and restart.");
    console.error("Screen capture permission denied");
    exit();
  }

  // ---- 1c. Create the control panel (for during-scan monitoring) -----
  var panel = floatyMod.createControlPanel();
  floatyMod.updateStatus(panel, "Initializing...");
  floatyMod.appendLog(panel, "Config applied, starting scan");

  // ---- 1d. Wire the Stop button -------------------------------------
  floatyMod.setButtonText(panel, "Stop");
  floatyMod.setButtonCallback(panel, function() {
    scanner.stopScanning();
    floatyMod.appendLog(panel, "Stop requested by user");
  });

  // ---- 1e. onFound callback ------------------------------------------
  function onFound(match) {
    floatyMod.updateStatus(panel, "Large Mushroom Found!");
    floatyMod.appendLog(panel, "Found \"" + match.templateName + "\" at (" +
      match.x + "," + match.y + ")");
    floatyMod.showDuringScan(panel, true);

    // Save screenshot to device gallery
    floatyMod.appendLog(panel, "Saving screenshot...");
    var screenImg = captureScreen();
    if (screenImg) {
      try {
        var saved = utils.saveScreenshotToGallery(
          screenImg,
          "mushroom_found_" + new Date().toISOString().replace(/[:.]/g, "-")
        );
        if (saved) {
          floatyMod.appendLog(panel, "Screenshot saved");
        } else {
          floatyMod.appendLog(panel, "Warning: screenshot may not have saved");
        }
      } finally {
        screenImg.recycle();
      }
    }
  }

  // ===================================================================
  // Phase 2 — Launch
  // ===================================================================

  // ---- 2a. Launch / bring-to-foreground Pikmin Bloom -----------------
  if (settings.autoLaunch) {
    floatyMod.updateStatus(panel, "Launching Pikmin Bloom...");
    floatyMod.appendLog(panel, "Launching " + config.app.packageName + "...");
    app.launchPackage(config.app.packageName);
  } else {
    floatyMod.updateStatus(panel, "Open the game manually...");
    floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
  }

  // Chunked polling: check every 2 s until the app is in the foreground
  var launched = false;
  var launchStart = new Date().getTime();

  while (new Date().getTime() - launchStart < config.app.launchTimeout) {
    var pkg = currentPackage();
    if (pkg === config.app.packageName) {
      launched = true;
      break;
    }
    sleep(2000);
  }

  if (!launched) {
    cleanupAndExit(
      panel,
      "Error: Launch failed",
      "Pikmin Bloom did not come to the foreground. " +
        "Please launch it manually and restart."
    );
  }

  floatyMod.appendLog(panel, "App is in foreground");

  // ---- 2b. Navigate to map using visual templates -------------------
  floatyMod.updateStatus(panel, "Navigating to map...");
  floatyMod.appendLog(panel, "Loading navigation templates...");

  // Load templates from ./templates/navigation/ subfolder (if any)
  var navTemplates = navigator.loadNavigationTemplates(config.detection.templateDir);

  if (navTemplates.length > 0) {
    floatyMod.appendLog(panel, "Navigating (" + navTemplates.length + " guides)...");
    var mapReached = navigator.navigateToMap(navTemplates, config);
    if (!mapReached) {
      cleanupAndExit(
        panel,
        "Error: Navigation failed",
        "Timed out trying to reach the game map. " +
          "Check your navigation templates and restart."
      );
    }
    floatyMod.appendLog(panel, "Map reached via navigation");

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

  floatyMod.updateStatus(panel, "Searching...");
  floatyMod.appendLog(panel, "Starting scan loop");

  // BLOCKING — runs the full scan loop until mushroom found or Stop.
  scanner.startScanning(config, templates, onFound, panel);

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  floatyMod.updateStatus(panel, "Scan complete");
  floatyMod.appendLog(panel, "Scan finished");
  floatyMod.setButtonText(panel, "Exit");
  floatyMod.setButtonCallback(panel, function() {
    userExiting = true;
  });

  // Wait so user can read final status, or tap Exit
  var userExiting = false;
  var cleanupStart = new Date().getTime();
  while (!userExiting && (new Date().getTime() - cleanupStart < 5000)) {
    sleep(200);
  }

  floatyMod.destroy(panel);
}

// Auto-execute
main();
