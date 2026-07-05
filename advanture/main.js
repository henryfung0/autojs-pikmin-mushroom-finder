/**
 * advanture/main.js — Pipeline orchestrator
 *
 * Orchestrates the adventure automation pipeline:
 *   Phase 1 — Setup          : Load templates, create panel
 *   Phase 2 — Enter Adventure: Navigate from main page into adventure UI
 *   Phase 3 — Scan           : Scroll and detect items, start adventures
 *   Phase 4 — Cleanup        : Show status, destroy panel
 *
 * Called by root main.js after the config dialog completes.
 */

"auto";

var config      = require("../ui/config");
var matcher     = require("../lib/matcher");
var floatyMod   = require("../ui/floaty");
var advFlow     = require("./advanture_flow");
var advState    = require("./advanture_state");

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

  // ── Merge UI dialog settings into config ──────────────────────────────
  if (settings) {
    if (settings.threshold !== undefined) {
      config.detection.threshold = settings.threshold;
    }
    if (settings.settleDelay !== undefined) {
      config.scan.settleDelay = settings.settleDelay;
    }
    if (settings.enableGift !== undefined) {
      config.advanture.enableGift = settings.enableGift;
    }
    if (settings.enablePlant !== undefined) {
      config.advanture.enablePlant = settings.enablePlant;
    }
    if (settings.enableFruit !== undefined) {
      config.advanture.enableFruit = settings.enableFruit;
    }
    if (settings.maxEmptyLoops !== undefined) {
      config.advanture.maxEmptyLoops = settings.maxEmptyLoops;
    }
    console.info("Adventure settings merged — threshold=" + config.detection.threshold +
      ", settleDelay=" + config.scan.settleDelay +
      ", collect gift=" + config.advanture.enableGift +
      " plant=" + config.advanture.enablePlant +
      " fruit=" + config.advanture.enableFruit +
      ", maxEmptyLoops=" + config.advanture.maxEmptyLoops);
  }

  // ===================================================================
  // Phase 1 — Setup
  // ===================================================================

  var templateDir = config.detection.templateDir;
  console.info("Loading templates from '" + templateDir + "' ...");

  var allTemplates = matcher.loadAllTemplates(templateDir, {
    excludeDirs: []
  });

  if (allTemplates.length === 0) {
    var errMsg = "No templates found at " + templateDir + ". Place .png files and restart.";
    toast(errMsg);
    console.error(errMsg);
    exit();
  }

  console.info("Loaded " + allTemplates.length + " template(s)");

  var panel = floatyMod.createControlPanel(function() {
    floatyMod.destroy(panel);
    exit();
  });
  floatyMod.appendLog(panel, "Adventure mode started");

  // ===================================================================
  // Phase 2 — Launch / Navigate
  // ===================================================================

  var captureGranted = false;
  try {
    captureGranted = images.requestScreenCapture(false);
  } catch (e) {
    console.warn("requestScreenCapture threw: " + e);
  }
  if (!captureGranted) {
    cleanupAndExit(
      panel,
      "Error: Capture denied",
      "Screen capture permission denied. Grant permission and restart."
    );
  }

  floatyMod.updateStatus(panel, "Ready");
  floatyMod.appendLog(panel, "Screen capture granted");

  if (settings && settings.autoLaunch) {
    floatyMod.updateStatus(panel, "Launching Pikmin Bloom...");
    floatyMod.appendLog(panel, "Launching " + config.app.packageName + "...");
    app.launchPackage(config.app.packageName);
    sleep(3000);

    var pkg = currentPackage();
    if (pkg === "com.android.systemui") {
      floatyMod.appendLog(panel, "System UI — tapping to dismiss...");
      var cx = Math.round(device.width / 2);
      var cy = Math.round(device.height / 2);
      press(cx, cy, 800);
      sleep(1500);
      var botCy = Math.round(device.height * 0.85);
      press(cx, botCy, 800);
      sleep(2000);
    }
    floatyMod.appendLog(panel, "App in foreground");
  } else {
    floatyMod.updateStatus(panel, "Open the game manually...");
    floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
    sleep(5000);
    floatyMod.appendLog(panel, "Proceeding to adventure scan...");
  }

  // ===================================================================
  // Phase 3 — Adventure Flow
  // ===================================================================

  floatyMod.updateStatus(panel, "Scanning...");
  floatyMod.appendLog(panel, "Starting adventure scan flow");

  advFlow.runAdvantureFlow(config, panel);

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  floatyMod.appendLog(panel, "Adventure finished");
  sleep(3000);
  floatyMod.destroy(panel);
}

module.exports = {
  run: run
};
