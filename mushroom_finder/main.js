/**
 * mushroom_finder/main.js — Pipeline orchestrator
 *
 * Orchestrates the 3-phase pipeline:
 *   Phase 1 — Setup          : Load templates, filter, create panel
 *   Phase 2 — Launch/Navigate: Launch app, navigate to map
 *   Phase 3 — Scan           : Run mushroom detection scan loop
 *   Phase 4 — Cleanup        : Show status, destroy panel
 *
 * Called by root main.js after the config dialog completes.
 */

"auto";

var config    = require("../ui/config");
var screenSt  = require("./screen_state");
var matcher   = require("../lib/matcher");
var scanner   = require("./02_scan_map");
var floatyMod = require("../ui/floaty");
var navModule = require("./01_navigate_to_map");
var mushroomHandler = require("./03_handle_mushroom");

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

function run(settings) {

  // ── Merge UI dialog settings into config ──────────────────────────
  // The config dialog returns values that must be written into the
  // config object so the detection pipeline actually uses them.
  if (settings) {
    if (settings.threshold !== undefined) {
      config.detection.threshold = settings.threshold;
    }
    if (settings.settleDelay !== undefined) {
      config.scan.settleDelay = settings.settleDelay;
    }
    if (settings.maxEmptyScrolls !== undefined) {
      config.scan.maxEmptyScrolls = settings.maxEmptyScrolls;
    }
    if (settings.detectLargeColor !== undefined) {
      config.detection.detectLargeColor = settings.detectLargeColor;
    }
    if (settings.detectLargeElement !== undefined) {
      config.detection.detectLargeElement = settings.detectLargeElement;
    }
    if (settings.largeColorThreshold !== undefined) {
      config.detection.largeColorThreshold = settings.largeColorThreshold;
    }
    if (settings.largeElementThreshold !== undefined) {
      config.detection.largeElementThreshold = settings.largeElementThreshold;
    }
    console.info("Settings merged — threshold=" + config.detection.threshold +
      ", largeColor=" + config.detection.largeColorThreshold +
      ", largeElement=" + config.detection.largeElementThreshold +
      ", settleDelay=" + config.scan.settleDelay +
      ", maxEmptyScrolls=" + config.scan.maxEmptyScrolls);
  }

  // ===================================================================
  // Phase 1 — Setup
  // ===================================================================

  var mushroomTemplatesDir = files.join(config.detection.templateDir, "mushrooms");
  console.info(
    "Loading mushroom templates from '" + mushroomTemplatesDir + "' ..."
  );
  var templates = matcher.loadAllTemplates(mushroomTemplatesDir);

  if (templates.length === 0) {
    var errMsg =
      "No mushroom templates found at " +
      mushroomTemplatesDir +
      ". Place .png files in templates/mushrooms/ and restart.";
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
    if (templates[i].name.indexOf("others/") !== -1) {
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
    mushroomHandler.handleMushroomFound(panel, match, navTemplates, navModule);
  }

  // ===================================================================
  // Phase 2 — Launch
  // ===================================================================

  var navTemplates = navModule.loadNavigationTemplates(config.detection.templateDir);

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
      mapReached = navModule.navigateToMap(navTemplates, config, panel);
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
          var state = screenSt.classifyScreenState(img);
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

module.exports = {
  run: run
};
