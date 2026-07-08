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

var config                     = require("../../ui/config");
var matcher                    = require("../../lib/matcher");
var floatyMod                  = require("../../ui/floaty");
var throwRepeatedSeedlingFlow  = require("./throw_repeated_seedling_flow");
var collectSeedlingsModule     = require("./collect_seedlings");
var farmSeedlingsModule        = require("./farm_seedlings");
var seedlingUtils              = require("./seedling_utils");
var advState                   = require("../advanture/advanture_state");

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
    if (settings.enableCollect !== undefined) {
      config.advanture.enableCollect = settings.enableCollect;
    }
    if (settings.enableFarm !== undefined) {
      config.advanture.enableFarm = settings.enableFarm;
    }
    if (settings.enableThrowRepeated !== undefined) {
      config.advanture.enableThrowRepeated = settings.enableThrowRepeated;
    }
    if (settings.maxEmptyLoops !== undefined) {
      config.advanture.maxEmptyLoops = settings.maxEmptyLoops;
    }
    console.info("Throw Repeated Seedling settings merged — threshold=" + config.detection.threshold +
      ", settleDelay=" + config.scan.settleDelay +
      ", enableCollect=" + config.advanture.enableCollect +
      " enableFarm=" + config.advanture.enableFarm +
      " enableThrowRepeated=" + config.advanture.enableThrowRepeated +
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
  });
  floatyMod.appendLog(panel, "Throw Repeated Seedling mode started");

  // ===================================================================
  // Phase 2 — Launch
  // ===================================================================

  floatyMod.updateStatus(panel, "Ready");

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
  // Phase 3 — Orchestrate Seedling Operations
  // ===================================================================

  var enableCollect       = config.advanture && config.advanture.enableCollect;
  var enableFarm          = config.advanture && config.advanture.enableFarm;
  var enableThrowRepeated = config.advanture && config.advanture.enableThrowRepeated;

  var anySeedlingOp = enableCollect || enableFarm || enableThrowRepeated;

  if (anySeedlingOp) {
    floatyMod.updateStatus(panel, "Loading seedling templates...");
    floatyMod.appendLog(panel, "Loading seedling templates...");
    var seedlingTemplates = seedlingUtils.loadThrowRepeatedSeedlingTemplates(templateDir);

    floatyMod.appendLog(panel, "Seedling templates — clicker:" + seedlingTemplates.seedlingPageClicker.length +
      " checker:" + seedlingTemplates.seedlingPageChecker.length +
      " collect:" + seedlingTemplates.collect.length +
      " throwItems:" + seedlingTemplates.throwItems.length);

    var mainNavTemplates = seedlingTemplates.mainNav.concat(seedlingTemplates.common);
    var commonTemplates  = seedlingTemplates.common;

    // Step 1: Ensure on main page
    floatyMod.appendLog(panel, "Ensuring on main page...");
    advState.isOnMainPage(mainNavTemplates, {
      threshold: 0.7,
      timeout: 30000,
      floaty: panel,
      dismissTemplates: commonTemplates
    });
    sleep(1000);

    // Step 2: Navigate to seedling page
    floatyMod.appendLog(panel, "Navigating to seedling page...");
    var reachedSeedlingPage = throwRepeatedSeedlingFlow.navigateToSeedlingPage(seedlingTemplates, panel);
    if (!reachedSeedlingPage) {
      floatyMod.appendLog(panel, "Could not reach seedling page — skipping seedling operations");
    } else {
      sleep(1000);

      // Step 3: Collect seedlings (optional)
      if (enableCollect) {
        floatyMod.appendLog(panel, "Collect enabled — starting collect...");
        collectSeedlingsModule.collectSeedlings(seedlingTemplates, panel);
        sleep(500);
      }

      // Step 4: Farm seedlings (optional)
      if (enableFarm) {
        floatyMod.appendLog(panel, "Farm enabled — starting farm...");
        farmSeedlingsModule.farmSeedlings(seedlingTemplates, panel);
        sleep(500);
      }

      // Step 5: Throw repeated seedling flow (optional)
      if (enableThrowRepeated) {
        floatyMod.appendLog(panel, "Throw repeated enabled — starting throw flow...");
        throwRepeatedSeedlingFlow.runThrowRepeatedSeedlingFlow(config, panel);
      } else {
        // Return to main page so user isn't left on seedling page
        floatyMod.appendLog(panel, "Returning to main page...");
        advState.isOnMainPage(mainNavTemplates, {
          threshold: 0.7,
          timeout: 30000,
          floaty: panel,
          dismissTemplates: commonTemplates
        });
        sleep(1000);
      }
    }
  } else {
    floatyMod.appendLog(panel, "No seedling operations enabled — skipping Phase 3");
  }

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  floatyMod.appendLog(panel, "Throw repeated seedling finished");
  sleep(1000);
  // Return panel and config so main.js can pass to adventure
  return { panel: panel, config: config };
}

module.exports = {
  run: run
};
