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

function main() {
  // ── Singleton guard: kill any previous instance of this script ─────
  var _selfId = engines.myEngine().id;
  engines.all().forEach(function(engine) {
    if (engine.id !== _selfId) {
      console.info("main: stopping existing instance (id=" + engine.id + ")");
      engine.forceStop();
    }
  });

  // ===================================================================
  // Phase 0 — Pre-flight Configuration Dialog
  // ===================================================================

  var settings = configUi.showConfigDialog();
  if (!settings) {
    exit();
  }

  config.detection.threshold = settings.threshold;
  config.debug.enabled = settings.debugMode;
  config.scan.settleDelay = settings.settleDelay;
  config.detection.detectLargeColor = settings.detectLargeColor;
  config.detection.detectLargeElement = settings.detectLargeElement;
  config.scan.maxEmptyScrolls = settings.maxEmptyScrolls;

  console.info("Config: threshold=" + settings.threshold +
    ", settleDelay=" + settings.settleDelay +
    ", autoLaunch=" + settings.autoLaunch +
    ", detectLargeColor=" + settings.detectLargeColor +
    ", detectLargeElement=" + settings.detectLargeElement +
    ", maxEmptyScrolls=" + settings.maxEmptyScrolls +
    ", debug=" + settings.debugMode);

  // ===================================================================
  // Phase 1 — Setup
  // ===================================================================

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

  // Separate "others" indicator templates (map-content markers like seeds/decor)
  // from mushroom detection templates.
  var othersTemplates = [];
  var mushroomTemplates = [];
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].name.indexOf("/others/") !== -1) {
      othersTemplates.push(templates[i]);
    } else {
      mushroomTemplates.push(templates[i]);
    }
  }
  console.info("Mushroom templates: " + mushroomTemplates.length + ", Others templates: " + othersTemplates.length);
  if (othersTemplates.length === 0) {
    console.warn("No 'others' templates found — empty-scroll detection disabled");
  }
  templates = mushroomTemplates;

  if (!config.detection.detectLargeColor) {
    var before = templates.length;
    templates = templates.filter(function(t) {
      return t.name.indexOf("large color") === -1;
    });
    console.info("Filtered large color templates: " + before + " → " + templates.length);
  }

  if (!config.detection.detectLargeElement) {
    var before = templates.length;
    templates = templates.filter(function(t) {
      return t.name.indexOf("large element") === -1;
    });
    console.info("Filtered large element templates: " + before + " → " + templates.length);
  }

  console.info("Remaining templates after filtering: " + templates.length);
  toast("Templates: " + templates.length + " remaining");

  var panel = floatyMod.createControlPanel(function() {
    scanner.stopScanning();
    floatyMod.destroy(panel);
    exit();
  });
  floatyMod.appendLog(panel, "Config applied, starting scan");

  // ---- onFound callback --------------------------------------------
  function onFound(match) {
    floatyMod.updateStatus(panel, "Large Mushroom Found!");
    floatyMod.appendLog(panel, "Found \"" + match.templateName + "\" at (" +
      match.x + "," + match.y + ")");
    floatyMod.showDuringScan(panel, true);

    var tapX = match.x + Math.round(match.width / 2);
    var tapY = match.y + Math.round(match.height / 2);
    floatyMod.appendLog(panel, "Clicking mushroom at (" + tapX + "," + tapY + ")");
    press(tapX, tapY, 1000);
    sleep(2000);
    navigator.waitForAndClickLarge(navTemplates, panel);
  }

  // ===================================================================
  // Phase 2 — Launch
  // ===================================================================

  var navTemplates = navigator.loadNavigationTemplates(config.detection.templateDir);

  if (settings.autoLaunch) {
    floatyMod.updateStatus(panel, "Launching Pikmin Bloom...");
    floatyMod.appendLog(panel, "Launching " + config.app.packageName + "...");
    app.launchPackage(config.app.packageName);

    sleep(3000);

    var pkg = currentPackage();
    if (pkg === "com.android.systemui") {
      floatyMod.appendLog(panel, "System UI in foreground — tapping to dismiss overlay...");
      var cx = Math.round(device.width / 2);
      var cy = Math.round(device.height / 2);
      press(cx, cy, 800);
      sleep(1500);
      var botCy = Math.round(device.height * 0.85);
      press(cx, botCy, 800);
      sleep(2000);
    }

    floatyMod.appendLog(panel, "App is in foreground");
  } else {
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
  } else {
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

  scanner.startScanning(config, templates, onFound, panel, {
    othersTemplates: othersTemplates,
    navTemplates: navTemplates,
    maxEmptyScrolls: config.scan.maxEmptyScrolls
  });

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  if (scanner.wasUserStop()) {
    floatyMod.appendLog(panel, "Scan stopped by user");
    floatyMod.destroy(panel);
    return;
  }

  floatyMod.appendLog(panel, "Scan finished");
  sleep(3000);
  floatyMod.destroy(panel);
}

main();
