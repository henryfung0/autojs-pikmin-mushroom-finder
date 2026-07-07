/**
 * advanture/throw_repeated_seedling_main.js — Pipeline orchestrator for Throw Repeated Seedling mode
 *
 * Orchestrates:
 *   Phase 1 — Setup          : Load templates, create panel
 *   Phase 2 — Launch         : Request screen capture, launch app
 *   Phase 3 — Throw Repeated Seedling Flow: Navigate to seedling page, detect throw items
 *   Phase 4 — Cleanup        : Destroy panel
 *
 * Called by root main.js when mode === "Throw Repeated Seedling".
 */

"auto";

var config      = require("../ui/config");
var matcher     = require("../lib/matcher");
var floatyMod   = require("../ui/floaty");
var throwRepeatedSeedlingFlow   = require("./throw_repeated_seedling_flow");

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

  // Merge UI dialog settings into config
  if (settings) {
    if (settings.threshold !== undefined) {
      config.detection.threshold = settings.threshold;
    }
    if (settings.settleDelay !== undefined) {
      config.scan.settleDelay = settings.settleDelay;
    }
    console.info("Throw Repeated Seedling settings merged — threshold=" + config.detection.threshold +
      ", settleDelay=" + config.scan.settleDelay);
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
  });
  floatyMod.appendLog(panel, "Throw Repeated Seedling mode started");

  // ===================================================================
  // Phase 2 — Launch
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
    floatyMod.appendLog(panel, "Proceeding to throw repeated seedling flow...");
  }

  // ===================================================================
  // Phase 3 — Throw Repeated Seedling Flow
  // ===================================================================

  floatyMod.updateStatus(panel, "Scanning...");
  floatyMod.appendLog(panel, "Starting throw repeated seedling flow");

  throwRepeatedSeedlingFlow.runThrowRepeatedSeedlingFlow(config, panel);

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  floatyMod.appendLog(panel, "Throw repeated seedling finished");
  sleep(3000);
  floatyMod.destroy(panel);
}

module.exports = {
  run: run
};
